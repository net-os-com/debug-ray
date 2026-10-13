/**
 * The design's own example schema, so an empty view has something to show.
 *
 * It is the NetOS shape rather than a generic one: a landlord database holding
 * tenants and domains, a tenant database every customer gets a copy of, and a
 * reference from one to the other that MySQL cannot enforce — which is the
 * case the diagram exists to make visible.
 */
export const NETOS_EXAMPLE = `// NetOS · landlord database + one database per tenant
Project netos {
  database_type: 'MySQL'
  Note: 'Landlord holds tenants and domains. Every tenant gets its own database.'
}

Table landlord.tenants [headercolor: #0A2D51, note: 'One row per customer, for example ANWB'] {
  id bigint [pk, increment]
  slug varchar(60) [unique, not null, note: 'Used as subdomain']
  name varchar(120) [not null]
  database varchar(64) [not null, note: 'Name of the tenant database']
  plan tenant_plan [default: 'standard']
  created_at timestamp
}

Table landlord.domains [headercolor: #0A2D51] {
  id bigint [pk, increment]
  tenant_id bigint [not null, ref: > landlord.tenants.id]
  domain varchar(255) [unique, not null]
}

Table landlord.admins [headercolor: #0A2D51] {
  id bigint [pk, increment]
  email varchar(255) [unique, not null]
  name varchar(120)
}

Enum tenant_plan {
  standard
  enterprise
  trial
}

Table tenant.users {
  id bigint [pk, increment]
  office_id bigint [ref: > tenant.offices.id]
  first_name varchar(60) [not null]
  last_name varchar(60)
  email varchar(255) [unique, not null]
  role user_role [default: 'member']
  last_seen_at timestamp [null]
  deleted_at timestamp [null]

  indexes {
    (office_id, role)
  }
}

Enum user_role {
  member
  host
  office_manager
  admin
}

Table tenant.offices {
  id bigint [pk, increment]
  name varchar(120) [not null]
  city varchar(80)
  floors int
  capacity int [note: 'Desks available for booking']
}

Table tenant.roles {
  id bigint [pk, increment]
  name varchar(60) [unique, not null]
}

Table tenant.role_user {
  role_id bigint [not null]
  user_id bigint [not null]

  indexes {
    (role_id, user_id) [pk]
  }
}

Ref: tenant.role_user.role_id > tenant.roles.id
Ref: tenant.role_user.user_id > tenant.users.id

Table tenant.activities [headercolor: #B45309, note: 'Lunches, workouts, socials and workshops'] {
  id bigint [pk, increment]
  office_id bigint [not null, ref: > tenant.offices.id]
  host_id bigint [not null, ref: > tenant.users.id]
  title varchar(120) [not null]
  description text [null]
  starts_at timestamp [not null]
  ends_at timestamp [null]
  seats int [null, note: 'Null means unlimited']
  status activity_status [default: 'draft']
  deleted_at timestamp [null]

  indexes {
    (office_id, starts_at) [name: 'activities_office_starts_idx']
  }
}

Enum activity_status {
  draft
  published
  cancelled
}

Table tenant.invites [headercolor: #B45309] {
  id bigint [pk, increment]
  activity_id bigint [not null, ref: > tenant.activities.id]
  user_id bigint [not null, ref: > tenant.users.id]
  invited_by bigint [ref: > tenant.users.id]
  status invite_status [default: 'pending']
  responded_at timestamp [null]

  indexes {
    (activity_id, status)
    (user_id, activity_id) [unique]
  }
}

Enum invite_status {
  pending
  accepted
  declined
}

Table tenant.activity_images [headercolor: #B45309] {
  id bigint [pk, increment]
  activity_id bigint [not null, ref: > tenant.activities.id]
  path varchar(255) [not null]
  position int [default: 0]
}

Table tenant.settings {
  id bigint [pk, increment]
  tenant_id bigint [not null, ref: > landlord.tenants.id, note: 'Lives in another database']
  locale varchar(5) [default: 'nl']
  brand_color varchar(7)
}

TableGroup landlord [color: #0A2D51] {
  landlord.tenants
  landlord.domains
  landlord.admins
}

TableGroup people [color: #047857] {
  tenant.users
  tenant.offices
  tenant.roles
  tenant.role_user
}

TableGroup activities [color: #B45309] {
  tenant.activities
  tenant.invites
  tenant.activity_images
}

Note seats_rule {
  'An invite can only be accepted while seats is null or higher than the number of accepted invites.'
}
`
