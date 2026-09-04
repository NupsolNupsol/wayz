import { http, unwrap } from './client'

export interface VersionLink {
  label: string
  to: string
}

export interface VersionCheck {
  by: string
  at: string
}

export interface VersionIssue {
  by: string
  note: string
  at: string
  status: 'OPEN' | 'RESOLVED'
}

export interface VersionChange {
  area: string
  title: string
  detail: string
  roles: string[]
  howToTest: string[]
  expect: string
  links?: VersionLink[]
  checks?: VersionCheck[]
  issues?: VersionIssue[]
}

export interface VersionRow {
  _id: string
  number: string
  name: string
  releasedAt: string
  summary: string
  highlights: string[]
  changeCount: number
  checkedCount: number
  openIssues: number
  areas: string[]
}

export interface VersionDetail {
  _id: string
  number: string
  name: string
  releasedAt: string
  summary: string
  highlights: string[]
  changes: VersionChange[]
}

export const versionsApi = {
  list: () => unwrap<VersionRow[]>(http.get('/public/versions')),
  detail: (id: string) => unwrap<VersionDetail>(http.get(`/public/versions/${id}`)),
  check: (id: string, index: number, by: string) =>
    unwrap<VersionDetail>(http.post(`/public/versions/${id}/changes/${index}/check`, { by })),
  report: (id: string, index: number, by: string, note: string) =>
    unwrap<VersionDetail>(http.post(`/public/versions/${id}/changes/${index}/issue`, { by, note })),
}
