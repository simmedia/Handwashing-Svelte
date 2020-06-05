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
    width: 70vw;
    background: #f7f7f7;
    display: flex;
    place-items: center;
    z-index: 222;
  }

  nav {
    width: 100%;
  }

  ul li {
    list-style-type: none;
    font-size: 1.6rem;
    margin-bottom: 20px;
    cursor: pointer;
    transition: 0.3s ease;
  }

  ul li:hover {
    color: #e9a528;
  }

  .close {
    position: absolute;
    top: 20px;
    right: 20px;
    transform: rotate(45deg);
    font-size: 3rem;
    color: #443e3e;
    cursor: pointer;
  }
</style>

{#if show}
  <div transition:fly={{ x: -500, opacity: 1 }} class="sidenav">
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
