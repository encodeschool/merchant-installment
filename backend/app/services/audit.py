from ..models.audit import AuditLog


def log_action(db, user_id: str, action: str, resource: str, resource_id: str, ip: str):
    entry = AuditLog(
        user_id=user_id,
        action=action,
        resource=resource,
        resource_id=resource_id,
        ip_address=ip,
    )
    db.add(entry)
    db.commit()
