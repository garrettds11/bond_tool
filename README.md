# Bond Tool (Vite + React + Tailwind)

## How to use with your existing file
1. Open `src/bond_assessment_tool_react.jsx` and **paste your component code** (it must `export default` a React component).
2. Install and run locally:
   ```bash
   npm install
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```
4. Deploy on **AWS Amplify**:
   - Connect this repo in Amplify Hosting.
   - Amplify will run `npm ci` and `npm run build` using `amplify.yml`.
   - It will serve the output from `/dist`.

## Notes
- Tailwind is preconfigured.
- If you want React Fast Refresh and plugins, you can add `@vitejs/plugin-react`.
- For charts, install `recharts`; for animations, install `framer-motion`:
  ```bash
  npm install recharts framer-motion
  ```
