# Husägarens handbok

**Publicerad:** https://rhorno.github.io/husagarens-handbok/

En komplett, faktagranskad och sökbar dokumentation för husägare i Sverige — 59 ämnen från bolån och försäkringar till el, tak, trädgård, smarta hem och hemberedskap. Skriven på svenska, för både nybörjare och proffs.

Varje ämne har en nivåtrappa: **Grunderna** (förutsätter ingen förkunskap), **Praktisk vägledning** (mellan) och **Fördjupning** (avancerad). Varje faktapåstående har en diskret, klickbar källhänvisning till en myndighet, branschorganisation eller erkänd expert (Boverket, Elsäkerhetsverket, MSB, Skatteverket m.fl.).

## Öppna sajten

Sajten är publicerad på https://rhorno.github.io/husagarens-handbok/. Den fungerar även lokalt utan server eller beroenden, direkt via `file://`:

```
open site/index.html
```

Publicering sker automatiskt: en push till `main` kör `.github/workflows/pages.yml`, som validerar innehållet, bygger om `site/data.js`, kör testerna och deployar `site/` till GitHub Pages.

Sök överst (`/` fokuserar sökrutan), bläddra bland kategorierna i sidopanelen, hoppa mellan avsnitt via "På sidan", och klicka på källsiffrorna för att se källan.

## Struktur

```
content/<kategori>/<ämne>.md   # innehållet, en markdown-fil per ämne
subjects.json                  # ämnesregister (id, titel, kategori, nyckelord)
crossrefs.json                 # kurerad karta över relaterade ämnen ("Se även")
build/                         # parser, validator, markdown-rendering, sökbibliotek
build.mjs                      # kompilerar content → site/data.js
site/                          # index.html, app.js, styles.css, search.js, data.js
tests/                         # node:test-tester för bygg-/parsersteg
```

## Uppdatera innehållet

1. Redigera eller lägg till en fil i `content/<kategori>/<ämne>.md`. Följ mallen: frontmatter (`id`, `titel`, `kategori`, `nyckelord`) och de nio sektionerna i ordning — Översikt, Grunderna, Regler & lagkrav, Praktisk vägledning, Fördjupning, Underhållsschema, Vanliga misstag, När ska du anlita proffs, Källor. Nya ämnen läggs även till i `subjects.json`.
2. Validera: `node build/check-content.mjs`
3. Bygg om: `node build.mjs` (skriver `site/data.js`)
4. Ladda om `site/index.html` i webbläsaren.

## Testa

```
node --test tests/*.test.mjs
```

## Källor och tillförlitlighet

Allt innehåll är framtaget genom djup research mot officiella källor och därefter adversariellt faktagranskat: en oberoende granskare har hämtat de citerade sidorna och kontrollerat att varje viktigt påstående (lagkrav, belopp, säkerhetsgränser, tidsfrister) faktiskt stöds av källan. Reglerna ändras dock över tid — kontrollera alltid aktuella belopp och regler hos respektive myndighet, och notera att många regler varierar mellan kommuner.

## Licens

MIT — se [LICENSE](LICENSE).
