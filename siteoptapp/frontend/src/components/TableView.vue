<script setup>
import { useCounterStore } from '@/stores/somestore.js'

const juttu = useCounterStore()

</script>

<template>
  <section>
    <div class="bg-white rounded-xl shadow-md relative p-3">
      <div class="w-max flex m-auto">
      <vue-excel-editor v-model="juttu.jsondata" page=10>
        <vue-excel-column field="user"   label="User ID"       type="string" width="80px" />
        <vue-excel-column field="name"   label="Name"          type="string" width="150px" />
        <vue-excel-column field="phone"  label="Contact"       type="string" width="130px" />
        <vue-excel-column field="gender" label="Gender"        type="select" width="50px" :options="['F','M','U']" />
        <vue-excel-column field="age"    label="Age"           type="number" width="70px" />
        <vue-excel-column field="birth"  label="Date Of Birth" type="date"   width="100px" />
      </vue-excel-editor>
      </div>
    </div>
</section>
</template>
