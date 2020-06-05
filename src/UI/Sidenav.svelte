<script>
  import { fly } from "svelte/transition";
  import { createEventDispatcher } from "svelte";

  let navLinks = ["Home", "About", "Handwashing", "Notes", "Contact"];

  export let currentPage;

  export let show = false;

  const dispatch = createEventDispatcher();

  const changePage = e => {
    dispatch("changePage", e);
  };
</script>

<style>
  .sidenav {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    width: 400px;
    background: #f7f7f7;
    padding: 30px;
    display: flex;
    place-items: center;
  }

  nav {
    width: 100%;
  }

  ul li {
    list-style-type: none;
    font-size: 2rem;
    margin-bottom: 20px;
  }

  .close {
    position: absolute;
    top: 40px;
    right: 40px;
    transform: rotate(45deg);
    font-size: 3rem;
    color: #443e3e;
    cursor: pointer;
  }
  
</style>

{#if show}
  <div transition:fly={{x: -500, opacity: 1}} class="sidenav">
    <span on:click={() => dispatch('closeNav')} class="close">+</span>
    <nav>
      <ul>
        {#each navLinks as link}
          <li
            class:active={currentPage === link}
            on:click={() => changePage(link)}>
            {link}
          </li>
        {/each}
      </ul>

    </nav>
  </div>
{/if}
