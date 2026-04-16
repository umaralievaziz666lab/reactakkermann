// ============================================================
// СИСТЕМА ПРАВ ДОСТУПА — AKKERMANN PULSE
// ============================================================

export const ROLES = {
  admin:    'Администратор',
  manager:  'Менеджер',
  engineer: 'Инженер',
  master:   'Мастер',
  staff:    'Сотрудник',
}

// Что может каждая роль
export const PERMISSIONS = {
  // Просмотр
  view_all_requests:    ['admin', 'manager', 'engineer', 'master', 'staff'],
  view_anonymous:       ['admin', 'manager'],         // видеть кто автор анонимных заявок
  view_analytics:       ['admin', 'manager'],
  view_users:           ['admin', 'manager'],
  view_logs:            ['admin', 'manager', 'engineer'],

  // Заявки
  create_request:       ['admin', 'manager', 'engineer', 'master', 'staff'],
  edit_own_request:     ['admin', 'manager', 'engineer', 'master', 'staff'],
  edit_any_request:     ['admin', 'manager'],
  delete_request:       ['admin'],
  change_status:        ['admin', 'manager', 'engineer'],
  assign_request:       ['admin', 'manager'],
  set_deadline:         ['admin', 'manager'],
  add_admin_comment:    ['admin', 'manager', 'engineer'],

  // Пользователи
  manage_users:         ['admin'],
  change_roles:         ['admin'],
  give_points:          ['admin', 'manager'],
  view_user_details:    ['admin', 'manager'],

  // Контент
  publish_news:         ['admin', 'manager'],
  manage_achievements:  ['admin'],
  manage_departments:   ['admin'],

  // Экспорт
  export_data:          ['admin', 'manager'],
}

// Проверка права
export function can(role, permission) {
  if (!role || !permission) return false
  const allowed = PERMISSIONS[permission]
  if (!allowed) return false
  return allowed.includes(role)
}

// Получить цвет роли
export function roleColor(role) {
  return {
    admin:    '#dc2626',
    manager:  '#d97706',
    engineer: '#2563eb',
    master:   '#059669',
    staff:    '#6b7280',
  }[role] || '#6b7280'
}

// Получить иконку роли
export function roleIcon(role) {
  return {
    admin:    '👑',
    manager:  '📊',
    engineer: '⚙️',
    master:   '🔧',
    staff:    '👤',
  }[role] || '👤'
}
