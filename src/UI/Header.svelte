<script>
  import page from "page.js";
  import { createEventDispatcher } from "svelte";
  import { routeLinks } from "../store/routes.js";

  export let currentPage;

  const dispatch = createEventDispatcher();

  function navigate(ctx, next) {
    dispatch("changePage", ctx.path);
  }

  page("/", navigate);
  page("/about", navigate);
  page("/notes", navigate);
  page("/handwashing", navigate);
  page("/contact", navigate);
  page.start({ hashbang: false });
</script>

<style>
  .header {
    width: 100%;
    background: #f7f7f7;
    display: flex;
    position: fixed;
    top: 0;
    left: 0;
    justify-content: center;
    z-index: 222;
  }

  .h-container {
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

  nav ul a {
    list-style-type: none;
    display: inline-block;
    text-decoration: none;
    margin-left: 50px;
    height: 100%;
    display: flex;
    place-items: center;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: 0.3s ease;
    color: #363636;
  }

  nav ul a:hover {
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
    display: none;
    flex-direction: column;
    justify-content: space-evenly;
  }
  .burger div {
    width: 100%;
    height: 4px;
    border-radius: 20px;
    background: #363636;
  }

  @media screen and (max-width: 700px) {
    nav {
      display: none;
    }
    .h-container {
      width: 100% !important;
      padding: 0px 20px;
    }
    .header .burger {
      display: flex !important;
    }
  }
</style>

<div class="header">
  <div class="h-container">
    <div class="logo">
      <span>
        <h3>simmedia</h3>
      </span>
    </div>
    <nav>
      <ul>
        {#each routeLinks as link}
          <a
            style="margin-left: 20px"
            class:active={currentPage === link.path}
            href={link.path}>
            {link.name}
          </a>
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
