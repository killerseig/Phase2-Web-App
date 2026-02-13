<template>
  <div class="unauth-wrapper">
    <div class="unauth-card">
      <div class="unauth-title">Unauthorized</div>
      <p class="unauth-text">You do not have access to this page.</p>
    </div>
  </div>
</template>

<style scoped>
.unauth-wrapper {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 10vh;
  background: #f8f9fa;
}

.unauth-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px 28px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08);
  text-align: center;
  max-width: 420px;
  width: 100%;
}

.unauth-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 8px;
  color: #111827;
}

.unauth-text {
  margin: 0;
  color: #4b5563;
  font-size: 0.975rem;
}
</style>
