// View state only. Source records and saved selections always come from the server.
export interface SdsViewState {
  jobId: string
  folderId: string
  search: string
}
const views = new Map<string, SdsViewState>()
export function getSdsViewState(uid: string, route: string) {
  return views.get(`${uid}:${route}`)
}
export function rememberSdsViewState(uid: string, route: string, state: SdsViewState) {
  views.set(`${uid}:${route}`, { ...state })
}
