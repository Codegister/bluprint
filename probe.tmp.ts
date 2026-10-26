import { fetchCognitoOutline } from "./src/convex/lib/cognito";
const course = JSON.parse(process.argv[2]);
const out = await fetchCognitoOutline(course);
console.log(JSON.stringify(out ? {label: out.label, url: out.sourceUrl, sections: out.sections.map(s => [s.title, s.topics.length])} : null));
