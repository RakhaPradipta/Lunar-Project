| ✅ | Auth: SuperAdmin login | `SuperAdmin` | `SuperAdmin` | seed account |
| ✅ | Auth: Admin org-1 login (orgId=1) | `1` | `1` | seed account |
| ✅ | TenantMgmt: Org B exists from previous run (idempotent) | `true` | `true` | reused |
| ✅ | Auth: Admin B login bound to org B | `3` | `3` | tenant-scoped admin (orgId from JWT) |
| ✅ | RBAC: Admin A denied creating organisasi | `403` | `403` | Authorize(Roles=SuperAdmin) |
| ✅ | Scoping: Admin A creates village -> auto orgId=1 | `1` | `1` | client orgId ignored for Admin |
| ✅ | Scoping: Admin B creates village -> auto orgId=3 | `3` | `3` | tenant binding on create |
| ✅ | Scoping: Admin A ?mine=true has 0 foreign villages | `0` | `0` | count=27 |
| ✅ | Scoping: Admin B ?mine=true has 0 foreign villages | `0` | `0` | tenant B view |
| ✅ | Isolation: Admin B cannot edit village of A (PUT) | `403` | `403` | cross-tenant write |
| ✅ | Isolation: Admin B cannot delete village of A | `403` | `403` | cross-tenant delete |
| ✅ | Sanity: Admin B CAN edit own village | `200` | `200` | own-tenant write ok |
| ✅ | Isolation: transfer attempt by non-super Admin returns 403 | `403` | `403` | explicit transfer denial |
| ✅ | Isolation: village stays in org B after transfer attempt | `3` | `3` | no side effects after 403 |
| ✅ | RBAC: Admin B denied detail of org 1 (foreign) | `403` | `403` | tenant detail guard |
| ✅ | RBAC: Anonymous denied organisasi list | `401` | `401` | auth required |
| ✅ | Isolation: Admin B denied booking list of village A | `403` | `403` | cross-tenant read |
| ✅ | Sanity: Admin B sees booking of own village | >=1 | 1 | positive visibility |
| ✅ | Isolation: Admin A visitor feed has 0 rows from village B | `0` | `0` | pengunjung scoped via village org |

