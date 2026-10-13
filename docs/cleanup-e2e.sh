#!/usr/bin/env bash
# ============================================================
# Cleanup E2E artifacts from DesaWisata DB (idempotent)
# Hapus: desa "*E2E*" (+ booking ikut cascade), admin org B
# (adminb@e2e.test), lalu organisasi "*E2E*".
# Wajib: API jalan di :5200. Idempoten — aman diulang.
# ============================================================
set -u
BASE="http://localhost:5200/api"

jget() { echo "$1" | sed -n 's/.*"'"$2"'":"\([^"]*\)".*/\1/p' | head -1; }
# ekstrak daftar nilai field dari array JSON: node lebih andal dari sed
ids_of() { node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));const a=Array.isArray(d.data)?d.data:(d.data?.items??[]);console.log(a.map(x=>x["'"$1"'"]).join("\n"))'; }

# Password akun seed tidak lagi hardcoded (keamanan) — wajib set env SEED_ADMIN_PASSWORD.
SUPER=$(curl -s $BASE/Auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"superadmin@desawisata.go.id\",\"password\":\"${SEED_ADMIN_PASSWORD:?Set SEED_ADMIN_PASSWORD terlebih dahulu}\"}")
TS=$(jget "$SUPER" token)
[ -z "$TS" ] && echo "FATAL: SuperAdmin login gagal — pastikan API jalan di :5200" && exit 1
AUTH="Authorization: Bearer $TS"

echo "=== 1. Hapus desa E2E (booking ikut ter-cascade) ==="
LIST=$(curl -s "$BASE/DesaWisata?pageSize=1000" -H "$AUTH")
DELETED=0
while IFS=$'\t' read -r ID NAMA; do
  [ -z "$ID" ] && continue
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$BASE/DesaWisata/$ID" -H "$AUTH")
  if [ "$CODE" == "200" ] || [ "$CODE" == "204" ]; then
    echo "   ✅ desa $ID '$NAMA' dihapus (booking cascade)"
    DELETED=$((DELETED+1))
  else
    echo "   ❌ desa $ID '$NAMA' gagal (HTTP $CODE)"
  fi
done < <(node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));const a=Array.isArray(d.data)?d.data:(d.data?.items??[]);a.filter(x=>/E2E/.test(x.namaDesa)).forEach(x=>console.log(x.id+"\t"+x.namaDesa))' <<<"$LIST")
echo "   total desa dihapus: $DELETED"

echo "=== 2. Hapus admin e2e (adminb@e2e.test) ==="
USERS=$(curl -s "$BASE/Organisasi/users" -H "$AUTH")
while IFS=$'\t' read -r ID EMAIL; do
  [ -z "$ID" ] && continue
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$BASE/Organisasi/users/$ID" -H "$AUTH")
  [ "$CODE" == "200" ] && echo "   ✅ user $ID ($EMAIL) dihapus" || echo "   ❌ user $ID ($EMAIL) gagal (HTTP $CODE)"
done < <(node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));const a=Array.isArray(d.data)?d.data:(d.data?.items??[]);a.filter(x=>x.email.endsWith("e2e.test")).forEach(x=>console.log(x.id+"\t"+x.email))' <<<"$USERS")

echo "=== 3. Hapus organisasi '*E2E*' ==="
ORGS=$(curl -s "$BASE/Organisasi" -H "$AUTH")
while IFS=$'\t' read -r ID NAMA; do
  [ -z "$ID" ] && continue
  [ "$ID" == "1" ] && continue # organisasi pusat tidak boleh & tidak akan match
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$BASE/Organisasi/$ID" -H "$AUTH")
  [ "$CODE" == "200" ] && echo "   ✅ organisasi $ID '$NAMA' dihapus" || echo "   ❌ organisasi $ID '$NAMA' gagal (HTTP $CODE)"
done < <(node -e 'const d=JSON.parse(require("fs").readFileSync(0,"utf8"));const a=Array.isArray(d.data)?d.data:(d.data?.items??[]);a.filter(x=>/E2E/.test(x.namaOrganisasi)).forEach(x=>console.log(x.id+"\t"+x.namaOrganisasi))' <<<"$ORGS")

echo "=== Selesai (idempoten: jalankan lagi = no-op) ==="
