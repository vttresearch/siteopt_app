<script setup>
import SimpleCell from './SimpleCell.vue'

const props = defineProps({
  somedata: Array,
})

</script>

<template>
  <table>
    <thead>
      <tr>
        <th></th>
        <th v-for="c in somedata">{{ c }}</th>  <!-- Column title -->
      </tr>
    </thead>
    <tbody>
      <tr v-for="i in somedata[0].length">
        <th>{{ i }}</th>  <!-- Row title-->
        <td v-for="c in somedata[1].length">
          <SimpleCell :v="somedata[c-1][i-1]"></SimpleCell>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style>
body {
  margin: 0;
}

table {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
}

th {
  background-color: #eee;
}

tr:first-of-type th {
  width: 100px;
}

tr:first-of-type th:first-of-type {
  width: 25px;
}

td {
  border: 1px solid #ccc;
  height: 1.5em;
  overflow: hidden;
}
</style>