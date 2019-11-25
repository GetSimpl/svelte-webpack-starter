import "./styles/index.scss";
import App from "./App.svelte";

const app = new App({
	target: document.body,
	props: {
		world: "World 🌎"
	}
});

export default app;
