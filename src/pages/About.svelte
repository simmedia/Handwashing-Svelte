<script>
import {createEventDispatcher} from 'svelte'
 import Button from '../UI/Button.svelte'

 const dispatch = createEventDispatcher()

 const handleClick = () => {
     console.log('handleClick clicked!');
     dispatch('action', {
         name: 'Stefan',
         age: 28,
         position: 'Front End Developer'
     })
     
 }
</script>

<style>
  
</style>

<div>
 <h1>About page</h1>
</div>

<Button on:click={handleClick} color="blue">
    Klikni
</Button>

<div class="row">
 <div class="col"></div>
</div>