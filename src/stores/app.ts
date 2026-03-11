import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const getInitialSidebarCollapsed = () => {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem('sidebarCollapsed') === 'true'
}

const persistSidebarCollapsed = (value: boolean) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem('sidebarCollapsed', String(value))
}

export const useAppStore = defineStore('app', () => {
  const currentJobId = ref<string | null>(null)
  const currentJobName = ref<string | null>(null)
  const sidebarCollapsed = ref(getInitialSidebarCollapsed())
  const sidebarOpenMobile = ref(false)

  const hasJob = computed(() => !!currentJobId.value)

  const clearJob = () => {
    currentJobId.value = null
    currentJobName.value = null
  }

  const setCurrentJob = (jobId: string, jobName: string | null) => {
    currentJobId.value = jobId
    currentJobName.value = jobName
  }

  const toggleSidebar = () => {
    sidebarCollapsed.value = !sidebarCollapsed.value
    persistSidebarCollapsed(sidebarCollapsed.value)
  }

  const setSidebarOpenMobile = (open: boolean) => {
    sidebarOpenMobile.value = open
  }

  const $reset = () => {
    clearJob()
    sidebarCollapsed.value = getInitialSidebarCollapsed()
    sidebarOpenMobile.value = false
  }

  return {
    currentJobId,
    currentJobName,
    sidebarCollapsed,
    sidebarOpenMobile,
    hasJob,
    clearJob,
    setCurrentJob,
    toggleSidebar,
    setSidebarOpenMobile,
    $reset,
  }
})
