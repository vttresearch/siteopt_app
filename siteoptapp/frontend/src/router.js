import { createRouter, createWebHashHistory } from "vue-router";
import { useAuthStore } from "@/stores/authstore.js";
import HomeView from "@/views/HomeView.vue";
import About from '@/views/About.vue';
import Login from "@/views/Login.vue";

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        { path: "/login/", name: "login", component: Login },
        { path: '/', name: 'home', component: HomeView , meta: { requiresAuth: true } },
        { path: '/about/', name: 'about',  component: About, meta: { requiresAuth: true } },
        ]
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  // FIRST navigation: fetch auth state once
  if (!auth.loaded) {
    await auth.fetchUser()
  }
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: "login" }
  }
  if (to.name === "login" && auth.isAuthenticated) {
    return { name: "home" }
  }
})

export default router
