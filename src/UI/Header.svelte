<script>
  import { createEventDispatcher } from "svelte";
  let navLinks = ["Home", "About", "Handwashing", "Notes", "Contact"];
  export let currentPage;

  const dispatch = createEventDispatcher();

  const changePage = e => {
    dispatch("changePage", e);
  };
</script>

<style>
  .header {
    width: 100%;
    background: #f7f7f7;
    display: flex;
    justify-content: center;
  }

  .container {
    width: 80vw;
    margin: 0 auto;
    height: 80px;
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
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
    transition: 0.3s ease;
  }

  nav ul li:hover {
    color: #e9a528;
  }

  .active {
    color: #e9a528;
    border-bottom-color: #e9a528;
  }
  .burger {
    width: 50px;
    height: 50px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
  }
  .burger div {
    width: 100%;
    height: 4px;
    border-radius: 20px;
    background: #363636;
  }
</style>

<div class="header">
  <div class="container">
    <div class="logo">
      <span>
        <h3>simmedia</h3>
      </span>
    </div>
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
    <div class="burger" on:click>
      <div />
      <div />
      <div />
    </div>
  </div>
</div>
