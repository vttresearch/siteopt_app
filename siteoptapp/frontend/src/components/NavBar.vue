<script setup>
import { useAuthStore } from "@/stores/authstore.js"
import { useRouter } from "vue-router"

const auth = useAuthStore()
const router = useRouter()

async function logout() {
  await auth.logout()
  router.push({ name: "login" })
}

</script>

<template>
  <nav class="bg-blue-700 border-b border-blue-500">
    <div class="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
      <div class="flex h-20 items-center justify-between">
        <div class="flex flex-1 items-center justify-between">
          <!-- App name -->
          <RouterLink to="/" class="flex items-center mr-4">
            <span class="hidden md:block text-white text-2xl font-bold ml-2">
              SiteOptApp
            </span>
          </RouterLink>

          <!-- Links -->
          <div class="flex items-center space-x-3">
            <RouterLink
              to="/"
              class="text-white bg-blue-600 hover:bg-blue-900 rounded-md px-3 py-2"
              :class="{ 'bg-indigo-500': $route.path === '/' }">
              Home
            </RouterLink>

            <RouterLink
              to="/about/"
              class="text-white bg-blue-600 hover:bg-blue-900 rounded-md px-3 py-2"
              :class="{ 'bg-indigo-500': $route.path === '/about/' }">
              About
            </RouterLink>

            <template v-if="auth.loaded">
              <template v-if="auth.isAuthenticated">
                <button @click="logout" class="text-white bg-blue-600 hover:bg-blue-900 rounded-md px-3 py-2">
                  Logout
                </button>
                <span class="text-white text-sm ml-4" title="Active username">{{ auth.user }}</span>
              </template>

              <template v-else>
                <RouterLink
                    to="/login/"
                    class="text-white bg-blue-600 hover:bg-blue-900 rounded-md px-3 py-2"
                    :class="{ 'bg-indigo-500': $route.path === '/login/' }">
                  Login
                </RouterLink>
              </template>
            </template>

          </div>
        </div>
      </div>
    </div>
  </nav>
</template>
