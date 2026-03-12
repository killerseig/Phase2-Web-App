import { vi } from 'vitest'

export const createFirestoreMocks = () => {
  const addDoc = vi.fn()
  const getDoc = vi.fn()
  const getDocs = vi.fn()
  const updateDoc = vi.fn()
  const deleteDoc = vi.fn()
  const setDoc = vi.fn()
  const orderBy = vi.fn((field: string, dir?: string) => ({ field, dir }))
  const where = vi.fn((field: string, op: string, value: unknown) => ({ field, op, value }))
  const limit = vi.fn((n: number) => ({ limit: n }))
  const collection = vi.fn((_db: unknown, ...pathSegments: string[]) => ({
    path: pathSegments.join('/'),
    pathSegments,
  }))
  const doc = vi.fn((_db: unknown, ...pathSegments: string[]) => ({
    path: pathSegments.slice(0, -1).join('/'),
    id: pathSegments[pathSegments.length - 1],
    pathSegments,
  }))
  const query = vi.fn((col: unknown, ...constraints: unknown[]) => ({ col, constraints }))
  const onSnapshot = vi.fn()
  const serverTimestamp = vi.fn(() => 'ts')

  return {
    addDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    setDoc,
    orderBy,
    where,
    limit,
    collection,
    doc,
    query,
    onSnapshot,
    serverTimestamp,
  }
}

type SnapshotDoc<T> = { id: string; data: T }

export const makeQuerySnapshot = <T extends Record<string, unknown>>(docs: SnapshotDoc<T>[]) => ({
  docs: docs.map((entry) => ({ id: entry.id, data: () => entry.data })),
  empty: docs.length === 0,
})
