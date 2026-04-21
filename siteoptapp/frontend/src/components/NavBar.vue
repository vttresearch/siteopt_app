<script setup>
import { useAuthStore } from "@/stores/auth"
import { useRouter } from "vue-router"

const auth = useAuthStore()
const router = useRouter()

async function logout() {
  await auth.logout()
  router.push({ name: "login" })
}

/*
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"
import { API_BASE } from "@/config.js";

const router = useRouter()
const user = ref(null)
const loading = ref(true)

async function fetchUser() {
  try {
    const url = `${API_BASE}api/me/`;
    const res = await fetch(url, { credentials: "include" })
    if (res.ok) {
      const data = await res.json()
      user.value = data.username
    } else {
      user.value = null
    }
  } catch (e) {
    user.value = null
  } finally {
    loading.value = false
  }
}


*/
</script>

<template>
  <nav class="bg-blue-700 border-b border-blue-500">
    <div class="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
      <div class="flex h-20 items-center justify-between">
        <div class="flex flex-1 items-center justify-between">
          <!-- Logo -->
          <RouterLink to="/" class="flex items-center mr-4">
            <span class="hidden md:block text-white text-2xl font-bold ml-2">
              SiteOptApp
            </span>
          </RouterLink>

          <!-- Links -->
          <div class="flex items-center space-x-3">
            <RouterLink
              to="/"
              class="text-white hover:bg-blue-900 rounded-md px-3 py-2"
              :class="{ 'bg-indigo-500': $route.path === '/' }"
            >
              Home
            </RouterLink>

            <RouterLink
              to="/about/"
              class="text-white hover:bg-blue-900 rounded-md px-3 py-2"
              :class="{ 'bg-indigo-500': $route.path === '/about/' }"
            >
              About
            </RouterLink>

            <template v-if="auth.loaded">
              <template v-if="auth.isAuthenticated">
                <span class="text-white text-sm ml-4">
                  {{ auth.user }}
                </span>

                <button
                  @click="logout"
                  class="text-white hover:bg-red-600 rounded-md px-3 py-2"
                >
                  Logout
                </button>
              </template>

              <template v-else>
                <RouterLink
                  to="/login"
                  class="text-white hover:bg-green-600 rounded-md px-3 py-2"
                >
                  Login
                </RouterLink>
              </template>
            </template>

            <!-- Auth section -->
            <!--
            <template v-if="!loading">
              <template v-if="user">
                <span class="text-white text-sm ml-4">
                  {{ user }}
                </span>

                <button
                  @click="logout"
                  class="text-white hover:bg-red-600 rounded-md px-3 py-2"
                >
                  Logout
                </button>
              </template>

              <template v-else>
                <RouterLink
                  to="/login"
                  class="text-white hover:bg-green-600 rounded-md px-3 py-2"
                >
                  Login
                </RouterLink>
              </template>
            </template>
            -->
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>
