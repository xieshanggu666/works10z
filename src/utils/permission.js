// 权限工具：基于角色与文档可见性
export const ROLE = { ADMIN: 'admin', EDITOR: 'editor', VIEWER: 'viewer' }

// 可新增/编辑/删除的（内容治理）
export function canEditContent(role) {
  return role === ROLE.ADMIN || role === ROLE.EDITOR
}

// 文档编辑者：角色可编辑 且（拥有者/协作成员/公开可编辑）
export function canEditDoc(role, doc, userId) {
  if (!doc) return false
  if (!canEditContent(role)) return false
  if (doc.ownerId === userId) return true
  if (doc.editors && doc.editors.includes(userId)) return true
  return false
}

// ---- 共享链接：统一的状态与授权判定（查看/编辑/撤销/过期都以此为唯一依据） ----
export const SHARE_STATE = { ACTIVE: 'active', REVOKED: 'revoked', EXPIRED: 'expired', INVALID: 'invalid' }

// 链接当前状态：已撤销 > 已过期 > 有效；记录不存在视为无效
export function shareState(share, now = new Date()) {
  if (!share) return SHARE_STATE.INVALID
  if (share.revokedAt) return SHARE_STATE.REVOKED
  if (share.expiresAt && new Date(share.expiresAt) <= now) return SHARE_STATE.EXPIRED
  return SHARE_STATE.ACTIVE
}

export function isShareActive(share) {
  return shareState(share) === SHARE_STATE.ACTIVE
}

// 链接是否授予指定操作：view — 任意有效链接；edit — 有效且 permission 为 edit
export function shareAllows(share, action) {
  if (!isShareActive(share)) return false
  if (action === 'edit') return share.permission === 'edit'
  return true
}

// 是否可查看某文档（可见性 + 拥有者 + 协作成员 + 有效共享链接）
export function canViewDoc(doc, userId, share) {
  if (!doc) return false
  if (doc.visibility === 'public') return true
  if (doc.visibility === 'team') {
    // team 指全员可见（演示简化：所有登录成员可见）
    return true
  }
  // private：仅拥有者与协作成员可见，或持有有效共享链接
  if (doc.ownerId === userId) return true
  if (doc.editors && doc.editors.includes(userId)) return true
  if (shareAllows(share, 'view')) return true
  return false
}

export function canDeleteDoc(role, doc, userId) {
  return canEditDoc(role, doc, userId)
}

export function roleLabel(role) {
  return { admin: '管理员', editor: '编辑者', viewer: '只读' }[role] || role
}