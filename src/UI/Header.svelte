<script>
import {createEventDispatcher} from 'svelte'
  let navLinks = ["Home", "About", "Handwashing", "Contact"];
  export let currentPage

const dispatch = createEventDispatcher()

  const changePage = (e) => {
      dispatch('changePage',e)
  }
</script>

<style>
  .header {
    width: 100%;
    height: 80px;
    display: inline-flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    background: #f7f7f7;
  }

  nav ul {
      height: 80px;
      display: flex;
      place-items: center;
  }

  nav ul li {
    list-style-type: none;
    display: inline-block;
    margin-left: 50px;
    height: 100%;
    display: flex;
    place-items: center;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: .3s ease;
  }

  nav ul li:hover {
      color: #e9a528;
  }

  .active {
      color: #e9a528;
      border-bottom-color: #e9a528;
  }

</style>

<div class="header">
  <div class="logo">
    <span>simmedia</span>
  </div>
  <nav>
    <ul>
      {#each navLinks as link}
        <li class:active={currentPage === link} on:click={() => changePage(link)}>{link}</li>
      {/each}
    </ul>
  </nav>
</div>

