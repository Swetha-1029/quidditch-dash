# ⚡ Quidditch Dash

A fast-paced single-tap browser game built with **React** and **Tailwind CSS**.

Help Harry Potter fly through obstacles on his Nimbus 2000 and catch the Golden Snitch!

🔗 **Live Demo:** [quidditch-dash-game.vercel.app](https://quidditch-dash-game.vercel.app)

---

## 🎮 How to Play

- **Tap** (mobile) or press **Space** (desktop) to make Harry fly up
- Avoid the wooden poles on both sides
- Catch the **Golden Snitch ✨** for bonus points (+100 pts)
- Every obstacle you pass earns **10 points**
- Game gets faster as your score increases

---

## 🛠️ Built With

- **React 18** — UI and game state management
- **Tailwind CSS** — styling and responsive layout
- **HTML5 Canvas** — game rendering (Harry, snitch, obstacles, background)
- **Vite** — build tool
- **Vercel** — deployment

---

## ✨ Features

- 🧹 Hand-drawn Harry Potter character on Nimbus 2000 (canvas)
- 🟡 Animated Golden Snitch with flapping wings and glow
- 🌤️ Parallax scrolling background with clouds, sun, Quidditch hoops and crowd
- 📱 Fully optimized for mobile devices
- 🔢 Device Pixel Ratio (DPR) support — sharp on Retina/AMOLED screens
- ⏱️ Delta time based physics — consistent speed on all devices (60Hz/120Hz)
- 🏆 Personal best score saved locally
- ✨ Invincibility frames on spawn with shimmer effect
- 🎯 Broom trail, tilt physics, soft floor/ceiling bounce

---

## 📁 Project Structure

```
quidditch-dash/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    └── QuidditchDash.jsx
```

---

## 🚀 Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 👩‍💻 Developed By

**Swetha**  
Submitted for **Snippet** Frontend Developer Intern — Round 1 Build Challenge
