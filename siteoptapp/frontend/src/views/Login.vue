<script setup>
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"
import { useAuthStore } from "@/stores/authstore.js"
import { API_BASE } from "@/config.js"

const router = useRouter()
const auth = useAuthStore()
const username = ref("")
const password = ref("")
const error = ref("")
const users = ref([])
const creating = ref(false)

async function loadUsers() {
  const res = await fetch(`${API_BASE}api/users/`, {
    credentials: "include",
  })
  if (res.ok) {
    const data = await res.json()
    users.value = data.users
  }
}

async function login() {
  error.value = ""
  try {
    await auth.login(username.value, password.value)
    router.push({ name: "home" })
  } catch {
    error.value = "Invalid credentials"
  }
}

async function register() {
  error.value = ""
  try {
    const res = await fetch(`${API_BASE}api/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        username: username.value,
        password: password.value,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      error.value = data.error || "Registration failed"
      return
    }

    // auto-login after creation
    await login()
  } catch {
    error.value = "Registration failed"
  }
}

onMounted(loadUsers)
</script>

<template>
  <form
    class="max-w-md mx-auto mt-10 space-y-4"
    @submit.prevent="login"
  >
    <h2 class="text-xl font-bold">Login</h2>

    <input
      v-model="username"
      placeholder="username"
      class="w-full border p-2"
    />

    <input
      v-model="password"
      type="password"
      placeholder="password"
      class="w-full border p-2"
    />

    <div class="flex gap-2">
      <button class="bg-blue-600 text-white px-4 py-2">
        Login
      </button>

      <button
        type="button"
        class="bg-green-600 text-white px-4 py-2"
        @click="register"
      >
        Create user
      </button>
    </div>

    <p v-if="error" class="text-red-600">
      {{ error }}
    </p>

    <div class="mt-6">
      <h3 class="font-semibold">Available users</h3>
      <ul class="text-sm text-blue-700">
        <li
          v-for="u in users"
          :key="u"
          class="cursor-pointer hover:underline"
          @click="username = u"
        >
          {{ u }}
        </li>
      </ul>
    </div>
  </form>
</template>
