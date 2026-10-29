const colors = [
  ["#1b1f3b", "#6a2c70"],
  ["#0f2027", "#2c5364"],
  ["#42275a", "#734b6d"],
  ["#134e5e", "#71b280"],
  ["#5f2c82", "#49a09d"],
];

const phrases = [
  "It did something!",
  "Nice. That was a button press.",
  "Colors changed. Very exciting.",
  "The button works. Ship it.",
  "Another press, another color.",
  "You are really good at this.",
];

const button = document.getElementById("action");
const message = document.getElementById("message");
const countEl = document.getElementById("count");

let count = 0;
let colorIndex = 0;

button.addEventListener("click", () => {
  count += 1;
  colorIndex = (colorIndex + 1) % colors.length;

  const [from, to] = colors[colorIndex];
  document.documentElement.style.setProperty("--bg-1", from);
  document.documentElement.style.setProperty("--bg-2", to);

  message.textContent = phrases[Math.floor(Math.random() * phrases.length)];
  countEl.textContent = String(count);

  message.classList.remove("pop");
  void message.offsetWidth;
  message.classList.add("pop");
});
