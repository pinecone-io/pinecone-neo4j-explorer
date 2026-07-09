// ESLint 9 flat config. Next 16 removed `next lint`, so linting now runs through
// the ESLint CLI (`eslint .`) using eslint-config-next's flat config.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      // Newly introduced (and opinionated) in the react-hooks plugin shipped
      // with Next 16. It flags pre-existing setState-in-effect patterns that
      // are intentional here; downgrade to a warning rather than refactor
      // behavior that has no test coverage.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
