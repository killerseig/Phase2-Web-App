export type ExplorerMenuTarget =
  | { kind: 'folder'; id: string }
  | { kind: 'document'; id: string }
  | { kind: 'background'; id: string }

export interface ExplorerMenuAction {
  id: string
  label: string
  icon?: string
  disabled?: boolean
  danger?: boolean
}
