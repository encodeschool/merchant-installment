import uuid


def log_action(db, user_id: str, action: str, resource: str, resource_id: str, ip: str):
    db.table("audit_logs").insert({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": action,
        "resource": resource,
        "resource_id": resource_id,
        "ip_address": ip,
    }).execute()
