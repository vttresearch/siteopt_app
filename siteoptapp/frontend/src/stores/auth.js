import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { API_BASE } from "@/config.js";

export const useAuthStore = defineStore("auth", () => {

  const user = ref(null)
  const loaded = ref(false)

  const isAuthenticated = computed(() => {
    return !!user.value
  })

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
    } catch {
      user.value = null
    } finally {
      loaded.value = true
    }
  }

  async function login(username, password) {
    const url = `${API_BASE}api/login/`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
      user.value = null
      throw new Error("Login failed")
    }
    // CRITICAL: refresh auth state
    await fetchUser()
  }

  async function logout() {
    const url = `${API_BASE}api/logout/`;
    await fetch(url, { credentials: "include" })
    user.value = null
    loaded.value = true
  }

  return { user, loaded, isAuthenticated, fetchUser, login, logout }
})
