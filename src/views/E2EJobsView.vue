<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

interface JobItem {
  id: string
  name: string
  code: string
  type: string
  gc: string
  address: string
}

const searchTerm = ref('')
const jobs = ref<JobItem[]>([
  { id: 'job-1', name: 'Acoustic Remodel', code: '1A', type: 'acoustics', gc: 'Phase 2', address: '123 Main St' },
  { id: 'job-2', name: 'Drywall Repair', code: '2B', type: 'drywall', gc: 'BuildCo', address: '456 Oak Ave' },
  { id: 'job-3', name: 'Paint Prep', code: '3C', type: 'paint', gc: 'PrimeWorks', address: '789 Pine Rd' },
])

const createForm = reactive({
  name: '',
  code: '',
  type: 'general',
  gc: '',
  address: '',
})

const filteredJobs = computed(() => {
  const query = searchTerm.value.trim().toLowerCase()
  if (!query) return jobs.value
  return jobs.value.filter((job) => {
    return [job.name, job.code, job.type, job.gc, job.address]
      .join(' ')
      .toLowerCase()
      .includes(query)
  })
})

function addJob() {
  if (!createForm.name.trim() || !createForm.code.trim()) return
  jobs.value.push({
    id: `job-${Date.now()}`,
    name: createForm.name.trim(),
    code: createForm.code.trim(),
    type: createForm.type,
    gc: createForm.gc.trim(),
    address: createForm.address.trim(),
  })
  createForm.name = ''
  createForm.code = ''
  createForm.gc = ''
  createForm.address = ''
}
</script>

<template>
  <main class="e2e-jobs-page" data-testid="e2e-jobs-page">
    <header class="e2e-jobs-header">
      <h1>E2E Jobs</h1>
      <p>Search and create jobs in this regression harness.</p>
    </header>

    <section class="e2e-jobs-search">
      <label>
        Search Jobs
        <input v-model="searchTerm" data-testid="jobs-search" type="search" placeholder="Search by name, code, or GC" />
      </label>
    </section>

    <section class="e2e-jobs-list" data-testid="jobs-list">
      <article
        v-for="job in filteredJobs"
        :key="job.id"
        class="e2e-job-card"
        :data-testid="`job-card-${job.code}`"
      >
        <h2>{{ job.name }}</h2>
        <p>{{ job.code }} · {{ job.type }}</p>
        <p>{{ job.gc }} · {{ job.address }}</p>
      </article>
      <div v-if="filteredJobs.length === 0" data-testid="jobs-empty">No jobs found.</div>
    </section>

    <section class="e2e-jobs-create">
      <h2>Create Job</h2>
      <label>
        Name
        <input v-model="createForm.name" data-testid="jobs-create-name" type="text" />
      </label>
      <label>
        Code
        <input v-model="createForm.code" data-testid="jobs-create-code" type="text" />
      </label>
      <label>
        GC
        <input v-model="createForm.gc" data-testid="jobs-create-gc" type="text" />
      </label>
      <label>
        Address
        <input v-model="createForm.address" data-testid="jobs-create-address" type="text" />
      </label>
      <button data-testid="jobs-create-button" type="button" @click="addJob">Add Job</button>
    </section>
  </main>
</template>

<style scoped>
.e2e-jobs-page {
  display: grid;
  gap: 1rem;
  padding: 1rem;
  max-width: 64rem;
}

.e2e-jobs-header {
  display: grid;
  gap: 0.5rem;
}

.e2e-jobs-search,
.e2e-jobs-create {
  display: grid;
  gap: 0.75rem;
}

.e2e-job-card {
  border: 1px solid #ddd;
  padding: 1rem;
  border-radius: 0.25rem;
}

.e2e-jobs-list {
  display: grid;
  gap: 0.75rem;
}
</style>
