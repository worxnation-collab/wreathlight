import { useEffect, useState } from "react";
import { api } from "../api";
import { APP_NAME } from "../../shared/brand";
import { Link } from "../router";

export default function HowAI() {
  const code = new URLSearchParams(location.search).get("c")?.toUpperCase() ?? "";
  const [church, setChurch] = useState<any>(null);
  const lang = (localStorage.getItem("wl:lang") === "es" ? "es" : "en") as "en" | "es";
  useEffect(() => { if (code) api(`/api/public/${code}`).then((d) => setChurch(d.church)).catch(() => {}); }, [code]);
  const pastor = church?.pastor_display_name ?? (lang === "es" ? "Tu pastor" : "Your pastor");
  const translation = church?.translation?.name ?? "a public-domain Bible (Berean Standard Bible, King James Version or World English Bible)";
  const aiOff = church && !church.ai_on;
  const back = code ? `/j/${code}` : "/";
  if (lang === "es")
    return (
      <main className="family"><div className="wrap">
        <p><Link to={back}>← Volver</Link></p>
        <h1>Cómo usamos la IA</h1>
        <div className="fcard howai">
          {aiOff ? <p>Tu iglesia apagó la IA. Las noches vienen del Plan inicial, escrito con ayuda de IA y revisado por una persona.</p> : null}
          <h2>Lo que la IA escribe</h2>
          <p>Un modelo de IA (Google Gemini) propone las preguntas, la oración, la actividad y por qué se escogió el pasaje. También propone la referencia bíblica.</p>
          <h2>Quién lo aprueba</h2>
          <p>{pastor} revisa cada noche, una por una, antes de que una familia la vea. Cada tarjeta dice quién la aprobó y cuándo.</p>
          <h2>De dónde viene la Escritura</h2>
          <p>El texto bíblico nunca lo escribe la IA. Lo llena el código desde {church ? church.translation.name : "una Biblia de dominio público"} y la Reina-Valera 1909 en español, palabra por palabra.</p>
          <h2>Lo que revisa el código en cada borrador</h2>
          <ul>
            <li>La referencia existe y el texto coincide letra por letra con la Biblia.</li>
            <li>La IA no cita la Escritura con sus propias palabras.</li>
            <li>Las preguntas para los pequeños son sencillas.</li>
            <li>Nada de miedo, culpa, promesas de prosperidad, leyendas presentadas como hechos ni secretos.</li>
            <li>Sin enlaces, correos, compras ni fuego sin un adulto.</li>
          </ul>
          <p>Si un borrador falla, se intenta de nuevo, luego con otro modelo, y si no, se usa el Plan inicial revisado por una persona. La iglesia puede apagar la IA cuando quiera.</p>
          <h2>Qué datos guardamos</h2>
          <p>Solo números: cuántos hogares se unieron y cuántas velas se encendieron. Los números menores de 5 se muestran como “menos de 5”.</p>
          <h2>Lo que nunca recogemos</h2>
          <p>No hay cuentas para familias. Nunca guardamos nombres, fotos, edades, escuelas ni direcciones IP. El apodo del hogar se queda en tu teléfono. La IA nunca ve datos de familias.</p>
          <p className="muted small">La IA recibe solo el tema, la tradición, las fechas y los títulos opcionales de los sermones. En el nivel gratuito, Google puede usar esas indicaciones para mejorar sus productos.</p>
        </div>
      </div></main>
    );
  return (
    <main className="family"><div className="wrap">
      <p><Link to={back}>← Back</Link></p>
      <h1>How we use AI</h1>
      <div className="fcard howai">
        {aiOff ? <p>Your church has turned AI off. Nights come from the Starter Plan, written with AI help and reviewed by a person.</p> : null}
        <h2>What AI drafts</h2>
        <p>An AI model (Google Gemini) suggests each night's questions, prayer, activity and a one-line reason for the passage. It also suggests which Bible passage to read.</p>
        <h2>Who approves it</h2>
        <p>{pastor} reviews every night, one at a time, before any family sees it. Each card shows who approved it and when.</p>
        <h2>Where Scripture comes from</h2>
        <p>AI never writes Scripture. Code fills in the verse text, word for word, from {translation}, and Reina-Valera 1909 for Spanish. Every draft is checked so the AI can't slip in its own version of a verse.</p>
        <h2>What code checks on every draft</h2>
        <ul>
          <li>The reference exists and the verse text matches the Bible character for character.</li>
          <li>The AI doesn't quote Scripture in its own words anywhere else.</li>
          <li>Questions for little ones stay simple.</li>
          <li>No fear or guilt, prosperity promises, legends stated as fact, or secrets.</li>
          <li>No links, emails, purchases, or open flame without an adult.</li>
        </ul>
        <p>If a draft fails, it is retried, then tried on a backup model, then replaced by the person-reviewed Starter Plan. The church can turn AI off at any time.</p>
        <h2>What data we keep</h2>
        <p>Counts only: how many households joined and how many candles were lit. Any count under 5 shows as “fewer than 5”.</p>
        <h2>What we never collect</h2>
        <p>Families have no accounts. We never store names, photos, ages, schools or IP addresses. Your household nickname stays on your phone. AI never sees anything about families.</p>
        <p className="muted small">The AI only receives the theme, tradition, dates and optional sermon titles. On Google's free tier, Google may use those prompts to improve its products, which is why nothing about families is ever sent.</p>
        <p className="muted small">{APP_NAME} is free and <a href="https://github.com/worxnation-collab/wreathlight">open source</a>.</p>
      </div>
    </div></main>
  );
}
