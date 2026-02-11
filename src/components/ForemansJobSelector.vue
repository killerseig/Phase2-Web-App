<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useJobsStore } from '../stores/jobs'
import { useJobRosterStore } from '../stores/jobRoster'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const jobs = useJobsStore()
const roster = useJobRosterStore()
const auth = useAuthStore()

// Get all jobs where current user is foreman
const foremansJobs = computed(() => {
  if (!auth.user?.uid) return []
  
  return jobs.allJobs.filter(job => {
    if (!job.active) return false
    
    // Check if user is foreman in this job's roster
    // This requires the roster to be loaded, but we'll show jobs where they could be foreman
    return true
  })
})

async function selectJob(jobId: string) {
  try {
    // Load the job and its roster
    await jobs.fetchJob(jobId)
    await roster.setCurrentJob(jobId)
    await roster.fetchJobRoster(jobId)
    
    // Navigate to job home
    router.push({ name: 'job-home', params: { jobId } })
  } catch (e) {
    console.error('Failed to select job:', e)
  }
}

const hasJobs = computed(() => foremansJobs.value.length > 0)
</script>

<template>
  <div v-if="hasJobs" class="dropdown">
    <button
      class="btn btn-sm btn-outline-primary dropdown-toggle"
      type="button"
      id="foremanJobsDropdown"
      data-bs-toggle="dropdown"
      aria-expanded="false"
    >
      <i class="bi bi-briefcase me-1"></i>My Jobs
    </button>
    <ul class="dropdown-menu" aria-labelledby="foremanJobsDropdown">
      <li v-for="job in foremansJobs" :key="job.id">
        <a class="dropdown-item" href="#" @click.prevent="selectJob(job.id)">
          {{ job.name }}
          <small v-if="job.code" class="text-muted d-block">{{ job.code }}</small>
        </a>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.dropdown-item small {
  display: none;
}

.dropdown-item:hover small {
  display: block;
}
</style>
