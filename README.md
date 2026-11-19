# Nexo

Biblioteca de leitura em português do Brasil para os anos finais do Ensino Fundamental. O acervo reúne 26 gêneros em fichas baseadas em materiais publicados, com 10 questões abertas por ficha e 260 ao todo. A leitura de cada ficha acontece dentro do aplicativo. Os materiais disponibilizados na íntegra e os materiais de apoio são identificados nos créditos. A publicação original e as condições de reprodução ficam em **Referência**. Veja o [alinhamento pedagógico](ALINHAMENTO.md) com o Saeb e a BNCC.

O gabarito orientativo de cada ficha aparece após o envio de todas as respostas preenchidas. As respostas abertas são conferidas pelo próprio estudante ou pelo professor. As tentativas, coleções e modelos ficam no armazenamento local e podem ser exportados. No GitHub Pages, o bloqueio é pedagógico. Quem examinar os arquivos públicos poderá acessar as respostas.

## Versão web

Com Rust, rustup e Python 3 disponíveis, execute:

```sh
rustup target add wasm32-unknown-unknown
python3 scripts/build.py
python3 -m http.server 4179 --bind 127.0.0.1 --directory dist
```

Abra http://127.0.0.1:4179. O build valida o acervo, compila a regra de conclusão em Rust para WebAssembly e prepara os arquivos em `dist/`.

## Aplicativo desktop

Instale as [dependências da plataforma](https://v2.tauri.app/start/prerequisites/) e a CLI Tauri 2. Depois execute:

```sh
cargo install tauri-cli --version '^2' --locked
cargo tauri dev
cargo tauri build
```

O Tauri empacota os textos, questões e imagens das fichas para consulta offline. Os links de referência exigem internet. Os instaladores são gerados em `src-tauri/target/release/bundle/`.

## Impressão e Typst

O visor permite imprimir a ficha ou salvar um PDF pelo diálogo de impressão do navegador. A impressão em lote usa as fichas marcadas no catálogo. O lote de gabaritos inclui as fichas concluídas. Em **Modelos e exportação**, baixe a ficha editável em Typst. Com o [Typst](https://typst.app/open-source/) instalado, compile o arquivo:

```sh
typst compile nexo-n001.typ nexo-n001.pdf
```

## GitHub Pages

Envie os arquivos do projeto à branch `main` de [zonaeducacional/nexo](https://github.com/zonaeducacional/nexo). Nesta cópia, o remoto `origin` já aponta para esse repositório.

```sh
git add .
git commit -m "Cria a biblioteca de leitura Nexo"
git branch -M main
git push -u origin main
```

Em **Settings → Pages → Build and deployment → Source**, selecione **GitHub Actions**. Se o primeiro push vier antes dessa configuração, execute **Publicar Nexo no GitHub Pages → Run workflow** na aba **Actions**. A URL esperada depois de uma publicação bem-sucedida é https://zonaeducacional.github.io/nexo/.

## Referência

O [Trama](https://github.com/aaronFortuno/trama), de Aaron Fortuno, serviu de referência para o fluxo de catálogo, visualização, coleções, impressão e gabaritos com pistas. O Nexo tem interface e atividades próprias. O catálogo principal reúne exemplos publicados. As fichas autorais da versão inicial continuam acessíveis por seus links e nas coleções existentes. As reproduções de Agostini e McCay em domínio público estão creditadas nas fichas, com links para o Wikimedia Commons.
