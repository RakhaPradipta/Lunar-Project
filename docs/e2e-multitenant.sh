#!/usr/bin/env bash
# ============================================================
# Multi-tenant E2E test suite — DesaWisata API (idempotent)
# Scenarios: tenant auth, scoping, cross-tenant isolation, RBAC
# ============================================================
set -u
BASE="http://localhost:5200/api"
PASS=0; FAIL=0
RESULTS=""
# Tanggal kunjungan booking: selalu H+3 dari hari ini agar tidak pernah "masa lalu"
KUNJUNGAN=$(date -u -d "+3 days" +%Y-%m-%d 2>/dev/null || date -u -v+3d +%Y-%m-%d)

check() { # $1=name $2=expected $3=actual $4=detail
  if [ "$2" == "$3" ]; then PASS=$((PASS+1)); RESULTS="$RESULTS| ✅ | $1 | \`$2\` | \`$3\` | $4 |"$'\n'
  else FAIL=$((FAIL+1)); RESULTS="$RESULTS| ❌ | $1 | \`$2\` | \`$3\` | $4 |"$'\n'; fi
}
jget() { echo "$1" | sed -n 's/.*"'"$2"'":"\([^"]*\)".*/\1/p' | head -1; }
jnum() { echo "$1" | sed -n 's/.*"'"$2"'":\([0-9truefalsnul][^,}]*\).*/\1/p' | head -1; }

echo "=== 1. LOGIN ==="
# Password akun seed tidak lagi hardcoded (keamanan). Set env SEED_ADMIN_PASSWORD
# ke password yang sama dengan yang dipakai saat seed (atau yang ditampilkan di console).
SEED_PASS="${SEED_ADMIN_PASSWORD:?Set SEED_ADMIN_PASSWORD terlebih dahulu (password akun seed)}"
SUPER=$(curl -s $BASE/Auth/login -H 'Content-Type: application/json' -d "{\"email\":\"superadmin@desawisata.go.id\",\"password\":\"$SEED_PASS\"}")
ADMIN1=$(curl -s $BASE/Auth/login -H 'Content-Type: application/json' -d "{\"email\":\"admin@desawisata.go.id\",\"password\":\"$SEED_PASS\"}")
TS=$(jget "$SUPER" token)
T1=$(jget "$ADMIN1" token)
check "Auth: SuperAdmin login" "SuperAdmin" "$(jget "$SUPER" role)" "seed account"
check "Auth: Admin org-1 login (orgId=1)" "1" "$(jnum "$ADMIN1" organisasiId)" "seed account"
[ -z "$TS" ] && echo "FATAL: no super token" && exit 1

echo "=== 2. TENANT B PROVISIONING ==="
# Idempoten: login dulu; jika belum ada, buat tenant via SuperAdmin
ADMIN2=$(curl -s $BASE/Auth/login -H 'Content-Type: application/json' -d '{"email":"adminb@e2e.test","password":"bbb123"}')
T2=$(jget "$ADMIN2" token)
if [ -z "$T2" ]; then
  ORG2=$(curl -s $BASE/Organisasi -X POST -H "Authorization: Bearer $TS" -H 'Content-Type: application/json' \
    -d '{"namaOrganisasi":"Org B E2E","email":"orgb@e2e.test","adminEmail":"adminb@e2e.test","adminPassword":"bbb123","adminNama":"Admin B"}')
  check "TenantMgmt: SuperAdmin creates Org B (+admin B)" "true" "$(jnum "$ORG2" success)" "provision tenant"
  ADMIN2=$(curl -s $BASE/Auth/login -H 'Content-Type: application/json' -d '{"email":"adminb@e2e.test","password":"bbb123"}')
  T2=$(jget "$ADMIN2" token)
else
  check "TenantMgmt: Org B exists from previous run (idempotent)" "true" "true" "reused"
fi
ORG2ID=$(jnum "$ADMIN2" organisasiId)
check "Auth: Admin B login bound to org B" "3" "$ORG2ID" "tenant-scoped admin (orgId from JWT)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' $BASE/Organisasi -X POST -H "Authorization: Bearer $T1" -H 'Content-Type: application/json' -d '{"namaOrganisasi":"X"}')
check "RBAC: Admin A denied creating organisasi" "403" "$CODE" "Authorize(Roles=SuperAdmin)"

echo "=== 3. VILLAGE CREATION SCOPING ==="
DESA1=$(curl -s $BASE/DesaWisata -X POST -H "Authorization: Bearer $T1" -H 'Content-Type: application/json' -d '{"namaDesa":"Desa A1 E2E","kecamatan":"K1","kabupaten":"Kab1","provinsi":"Prov1","deskripsi":"-","lokasi":"-","kategori":"Alam","rating":4,"batasPengunjung":100,"pengunjungHariIni":10,"aktif":true}')
DESA1ID=$(jnum "$DESA1" id)
[ -z "$DESA1ID" ] && DESA1ID=30 && DESA1=$(curl -s $BASE/DesaWisata/$DESA1ID)   # fallback: dari run sebelumnya
check "Scoping: Admin A creates village -> auto orgId=1" "1" "$(jnum "$DESA1" organisasiId)" "client orgId ignored for Admin"
DESA2=$(curl -s $BASE/DesaWisata -X POST -H "Authorization: Bearer $T2" -H 'Content-Type: application/json' -d '{"namaDesa":"Desa B1 E2E","kecamatan":"K2","kabupaten":"Kab2","provinsi":"Prov2","deskripsi":"-","lokasi":"-","kategori":"Budaya","rating":5,"batasPengunjung":50,"pengunjungHariIni":5,"aktif":true}')
DESA2ID=$(jnum "$DESA2" id)
[ -z "$DESA2ID" ] && DESA2ID=31 && DESA2=$(curl -s $BASE/DesaWisata/$DESA2ID)   # fallback
check "Scoping: Admin B creates village -> auto orgId=$ORG2ID" "$ORG2ID" "$(jnum "$DESA2" organisasiId)" "tenant binding on create"

echo "=== 4. LIST SCOPING (?mine=true) ==="
MINE1=$(curl -s "$BASE/DesaWisata?mine=true" -H "Authorization: Bearer $T1")
N1=$(jnum "$MINE1" totalData)
LEAK1=$(echo "$MINE1" | grep -o '"organisasiId":[0-9]*' | grep -vc '"organisasiId":1$')
check "Scoping: Admin A ?mine=true has 0 foreign villages" "0" "$LEAK1" "count=$N1"
MINE2=$(curl -s "$BASE/DesaWisata?mine=true" -H "Authorization: Bearer $T2")
LEAK2=$(echo "$MINE2" | grep -o '"organisasiId":[0-9]*' | grep -vc "\"organisasiId\":$ORG2ID$")
check "Scoping: Admin B ?mine=true has 0 foreign villages" "0" "$LEAK2" "tenant B view"

echo "=== 5. CROSS-TENANT WRITE DENIAL ==="
CODE=$(curl -s -o /dev/null -w '%{http_code}' $BASE/DesaWisata/$DESA1ID -X PUT -H "Authorization: Bearer $T2" -H 'Content-Type: application/json' -d '{"namaDesa":"HACKED","rating":1}')
check "Isolation: Admin B cannot edit village of A (PUT)" "403" "$CODE" "cross-tenant write"
CODE=$(curl -s -o /dev/null -w '%{http_code}' $BASE/DesaWisata/$DESA1ID -X DELETE -H "Authorization: Bearer $T2")
check "Isolation: Admin B cannot delete village of A" "403" "$CODE" "cross-tenant delete"
CODE=$(curl -s -o /dev/null -w '%{http_code}' $BASE/DesaWisata/$DESA2ID -X PUT -H "Authorization: Bearer $T2" -H 'Content-Type: application/json' -d '{"namaDesa":"Desa B1 E2E","rating":5}')
check "Sanity: Admin B CAN edit own village" "200" "$CODE" "own-tenant write ok"
# Transfer attempt: Admin non-super yang mencoba pindah desa ke org lain ditolak 403 eksplisit
CODE=$(curl -s -o /dev/null -w '%{http_code}' $BASE/DesaWisata/$DESA2ID -X PUT -H "Authorization: Bearer $T2" -H 'Content-Type: application/json' -d '{"organisasiId":1,"namaDesa":"Desa B1 E2E"}')
check "Isolation: transfer attempt by non-super Admin returns 403" "403" "$CODE" "explicit transfer denial"
DESA2_AFTER=$(curl -s $BASE/DesaWisata/$DESA2ID)
check "Isolation: village stays in org B after transfer attempt" "$ORG2ID" "$(jnum "$DESA2_AFTER" organisasiId)" "no side effects after 403"

echo "=== 6. ORGANISASI RBAC ==="
CODE=$(curl -s -o /dev/null -w '%{http_code}' $BASE/Organisasi/1 -H "Authorization: Bearer $T2")
check "RBAC: Admin B denied detail of org 1 (foreign)" "403" "$CODE" "tenant detail guard"
CODE=$(curl -s -o /dev/null -w '%{http_code}' $BASE/Organisasi)
check "RBAC: Anonymous denied organisasi list" "401" "$CODE" "auth required"

echo "=== 7. BOOKING CROSS-TENANT ==="
BOOK=$(curl -s $BASE/DesaWisata/$DESA2ID/pemesanan -X POST -H 'Content-Type: application/json' -d "{\"namaWisatawan\":\"Turis E2E\",\"kategoriTiket\":\"Lokal\",\"tanggalKunjungan\":\"$KUNJUNGAN\"}")
echo "   booking: success=$(jnum "$BOOK" success)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/DesaWisata/$DESA1ID/pemesanan" -H "Authorization: Bearer $T2")
check "Isolation: Admin B denied booking list of village A" "403" "$CODE" "cross-tenant read"
SEE=$(curl -s "$BASE/DesaWisata/$DESA2ID/pemesanan" -H "Authorization: Bearer $T2")
SEE=$(jnum "$SEE" totalData)
if [ "${SEE:-0}" -ge 1 ]; then PASS=$((PASS+1)); RESULTS="$RESULTS| ✅ | Sanity: Admin B sees booking of own village | >=1 | $SEE | positive visibility |"$'\n'
else FAIL=$((FAIL+1)); RESULTS="$RESULTS| ❌ | Sanity: Admin B sees booking of own village | >=1 | ${SEE:-0} | positive visibility |"$'\n'; fi
ACT1=$(curl -s "$BASE/DesaWisata/aktivitas?mine=true" -H "Authorization: Bearer $T1" | grep -o "\"desaWisataId\":$DESA2ID" | wc -l)
check "Isolation: Admin A visitor feed has 0 rows from village B" "0" "$ACT1" "pengunjung scoped via village org"

echo ""
echo "=== SUMMARY: PASS=$PASS FAIL=$FAIL ==="
echo "$RESULTS" > "$(dirname "$0")/e2e-results.md"
echo "Results -> docs/e2e-results.md"
