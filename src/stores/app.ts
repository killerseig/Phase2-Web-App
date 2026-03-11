import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => {
    // Read from localStorage, default to false (expanded).
    const savedState = typeof localStorage !== 'undefined' ? localStorage.getItem('sidebarCollapsed') : null
    const initialCollapsed = savedState === 'true'

    return {
      currentJobId: null as string | null,
      currentJobName: null as string | null,
      sidebarCollapsed: initialCollapsed,
      sidebarOpenMobile: false,
    }
  },

  getters: {
    hasJob: (s) => !!s.currentJobId,
  },

  actions: {
    clearJob() {
      this.currentJobId = null
      this.currentJobName = null
    },

    setCurrentJob(jobId: string, jobName: string | null) {
      this.currentJobId = jobId
      this.currentJobName = jobName
    },

    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sidebarCollapsed', this.sidebarCollapsed.toString())
      }
    },

    setSidebarOpenMobile(open: boolean) {
      this.sidebarOpenMobile = open
    },
  },
})
