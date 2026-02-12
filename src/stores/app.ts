import { defineStore } from 'pinia'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuthStore } from './auth'

export type JobRole = 'manager' | 'employee' | 'shop' | null

export const useAppStore = defineStore('app', {
  state: () => {
    // Read from localStorage, default to false (expanded)
    const savedState = typeof localStorage !== 'undefined' ? localStorage.getItem('sidebarCollapsed') : null
    const initialCollapsed = savedState === 'true'
    
    return {
      currentJobId: null as string | null,
      currentJobName: null as string | null,
      currentJobCode: null as string | null,
      currentJobRole: null as JobRole,
      loadingJob: false,
      sidebarCollapsed: initialCollapsed,
      sidebarOpenMobile: false,
    }
  },

  getters: {
    hasJob: (s) => !!s.currentJobId,
    canManageJob: (s) => s.currentJobRole === 'manager',
  },

  actions: {
    clearJob() {
      this.currentJobId = null
      this.currentJobName = null
      this.currentJobCode = null
      this.currentJobRole = null
    },

    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
      // Only save to localStorage if available
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sidebarCollapsed', this.sidebarCollapsed.toString())
      }
      console.log('Sidebar toggled, now collapsed:', this.sidebarCollapsed)
    },

    setSidebarOpenMobile(open: boolean) {
      this.sidebarOpenMobile = open
    },

    async loadJob(jobId: string) {
      const auth = useAuthStore()
      if (!auth.user) return

      this.loadingJob = true

      const snap = await getDoc(doc(db, 'jobs', jobId))
      if (!snap.exists()) {
        this.clearJob()
        this.loadingJob = false
        return
      }

      const data = snap.data() as any
      const uid = auth.user.uid

      this.currentJobId = jobId
      this.currentJobName = data.name ?? 'Job'
      this.currentJobCode = data.code ?? null

      // ✅ ADMIN OVERRIDE: admin is effectively manager on every job
      if (auth.role === 'admin') {
        this.currentJobRole = 'manager'
        this.loadingJob = false
        return
      }

      // ✅ EMPLOYEE/SHOP OVERRIDE: employees and shop users have implicit access to all jobs
      if (auth.role === 'employee' || auth.role === 'shop') {
        this.currentJobRole = auth.role === 'shop' ? 'shop' : 'employee'
        this.loadingJob = false
        return
      }

      // Check membership subcollection (jobs/{jobId}/members/{uid})
      try {
        const memberSnap = await getDoc(doc(db, 'jobs', jobId, 'members', uid))
        if (memberSnap.exists()) {
          const memberData = memberSnap.data() as any
          this.currentJobRole = memberData.role ?? null
        } else {
          this.currentJobRole = null
        }
      } catch (e) {
        console.error('Failed to load job membership:', e)
        this.currentJobRole = null
      }

      this.loadingJob = false
    },
  },
})
