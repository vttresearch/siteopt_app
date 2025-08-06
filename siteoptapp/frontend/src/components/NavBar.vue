<script setup>
</script>

<template>
  <nav class="bg-blue-700 border-b border-blue-500">
      <div class="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
        <div class="flex h-20 items-center justify-between">
          <div class="flex flex-1 items-center justify-center md:items-stretch md:justify-start">
            <!-- Logo -->
            <RouterLink to="/" class="flex flex-shrink-0 items-center mr-4">
              <!-- <img class="h-10 w-auto" src="images/logo.png" alt="Vue Jobs" /> -->
              <span class="hidden md:block text-white text-2xl font-bold ml-2"
                >SiteOptApp</span>
            </RouterLink>
            <div class="md:ml-auto">
              <div class="flex space-x-2">
                <RouterLink to="/" class="text-white hover:bg-blue-900 hover:text-white rounded-md px-3 py-2" :class="{ 'bg-indigo-500': $route.path === '/' }"
                  >Home</RouterLink>
                <RouterLink to="/about/" class="text-white hover:bg-blue-900 hover:text-white rounded-md px-3 py-2" :class="{ 'bg-indigo-500': $route.path === '/about/' }"
                  >About</RouterLink>
                <RouterLink to="/debug/" class="text-white hover:bg-blue-900 hover:text-white rounded-md px-3 py-2" :class="{ 'bg-indigo-500': $route.path === '/debug/' }"
                  >Debug</RouterLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
</template>
