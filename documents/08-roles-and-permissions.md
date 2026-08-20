# 08 — Roles and Permissions

The system has four roles.

```text
SUPER_ADMIN
LAND_REGISTRY
REAL_ESTATE_COMPANY
PUBLIC_USER
```

Authentication uses JWT. Users only see functions allowed for their role.

## Super admin

Developer / system operator.

Can:

- Manage users and roles
- Load or refresh datasets
- View system health
- View all transactions and risk assessments
- Review agent logs
- Configure risk thresholds
- Manage transaction types and verification rules

## Land registry

Authoritative administrator of official records.

Can:

- Register properties
- Approve or reject transactions
- Verify documents
- Confirm ownership changes
- Add official records
- View blockchain integrity
- Resolve flagged cases
- Review risk reports
- Mark a case as reviewed (not simply delete it)

## Real estate company

Pre-transaction checker. Similar to reading a passbook before accepting a transfer.

Can:

- Search a property before a transaction
- Verify ownership
- Verify title and registration details
- Check encumbrances
- Check transaction history
- Submit a transaction for analysis
- Receive a risk assessment and evidence report

Cannot alter official property history.

## Public user

Limited to their own property, like a personal passbook.

Can:

- View properties they own
- View their ownership history
- Check document and blockchain verification
- View transaction status
- Submit an inquiry
- See limited public property information

Cannot see another person’s NIC, phone number, password-related data, or private documents.

## Permission matrix

| Function | Public user | Real estate company | Land registry | Super admin |
| --- | --- | --- | --- | --- |
| Login | Yes | Yes | Yes | Yes |
| View own property / history | Yes | Yes | Yes | Yes |
| Search properties and transactions | Limited public | Yes | Yes | Yes |
| Run verification | Own records | Yes | Yes | Yes |
| Run risk analysis | View own result | Submit / view | Yes | Yes |
| Approve or reject transactions | No | No | Yes | Yes |
| Alter official history | No | No | Yes | Yes |
| Manage users and thresholds | No | No | No | Yes |
| Load datasets | No | No | No | Yes |
| Review agent logs | No | No | Limited | Yes |

## Related files

- Overview: [01-overview.md](01-overview.md)
- Frontend by role: [frontend.md](frontend.md)
- SRS: [srs.md](srs.md)
