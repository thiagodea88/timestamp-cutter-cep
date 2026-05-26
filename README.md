# Timestamp Cutter CEP

Plugin CEP/ExtendScript para Adobe Premiere Pro 2026 que aplica apenas razor cuts diretamente na sequencia selecionada, a partir de ranges de timestamps.

Este projeto nao usa UXP, nao usa manifestVersion 5 e nao gera `.ccx`. A arquitetura continua sendo CEP + ExtendScript + `CSInterface.evalScript()`.

## O que o plugin faz

- Lista as sequencias do projeto.
- Permite escolher uma sequencia.
- Permite adicionar ranges com Start Time e End Time.
- Ao clicar em Apply Cuts, aplica cortes nos pontos de inicio e fim de cada range.
- Opcionalmente, com `Keep only selected ranges`, remove os trechos fora dos ranges selecionados.
- Mostra logs claros no painel.

## O que o plugin nao faz

- Nao cria subsequencias.
- Nao cria novas sequencias.
- Nao duplica sequencias.
- Nao renomeia sequencias.
- Nao renomeia clips.
- Nao deleta clips.
- Nao move clips.
- Nao faz ripple delete.
- Nao aplica labels ou cores.
- Nao exporta.
- Nao gera XML/EDL.
- Nao usa IA.

Importante: o plugin modifica diretamente a sequencia selecionada.

Por padrao, `Keep only selected ranges` fica desativado. Nesse modo, o plugin apenas aplica cortes e nao deleta nada.

## Instalacao no Windows

1. Feche o Adobe Premiere Pro.
2. Clique com o botao direito em `INSTALL.bat`.
3. Escolha `Run as administrator`.
4. Aguarde a copia dos arquivos.
5. Abra o Premiere Pro novamente.

O instalador copia o plugin para:

```text
C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\TimestampCutterCEP
```

## PlayerDebugMode

Extensoes CEP nao assinadas precisam do PlayerDebugMode ativado. O `INSTALL.bat` configura automaticamente:

```cmd
reg add "HKCU\Software\Adobe\CSXS.8" /v "PlayerDebugMode" /t REG_SZ /d "1" /f
reg add "HKCU\Software\Adobe\CSXS.9" /v "PlayerDebugMode" /t REG_SZ /d "1" /f
reg add "HKCU\Software\Adobe\CSXS.10" /v "PlayerDebugMode" /t REG_SZ /d "1" /f
reg add "HKCU\Software\Adobe\CSXS.11" /v "PlayerDebugMode" /t REG_SZ /d "1" /f
reg add "HKCU\Software\Adobe\CSXS.12" /v "PlayerDebugMode" /t REG_SZ /d "1" /f
reg add "HKCU\Software\Adobe\CSXS.13" /v "PlayerDebugMode" /t REG_SZ /d "1" /f
reg add "HKCU\Software\Adobe\CSXS.14" /v "PlayerDebugMode" /t REG_SZ /d "1" /f
```

## Como abrir no Premiere

1. Abra um projeto no Adobe Premiere Pro.
2. Abra ou crie uma sequencia.
3. Va em `Window > Extensions > Timestamp Cutter`.

## Como usar

1. Clique em `Refresh` para listar as sequencias.
2. Escolha a sequencia no dropdown `Select Sequence`.
3. Em `Time Ranges`, preencha `Start Time` e `End Time`.
4. Use `+ Add Range` para adicionar mais ranges.
5. Deixe `Keep only selected ranges` desativado para apenas aplicar cortes.
6. Ative `Keep only selected ranges` somente se quiser deletar tudo fora dos ranges selecionados.
7. Clique em `Apply Cuts`.
8. Confirme a mensagem exibida pelo painel.

Exemplo:

```text
Start Time: 1:00
End Time:   1:22
```

O plugin aplica razor em:

```text
1:00
1:22
```

Com dois ranges:

```text
1:00 - 1:22
1:25 - 1:55
```

O plugin aplica razor em:

```text
1:00
1:22
1:25
1:55
```

Com `Keep only selected ranges` ativado, o plugin tenta remover os trechos fora dos ranges e, quando a API disponivel permitir, tenta fechar os espacos com ripple delete.

## Formatos de tempo aceitos

- `1:00`
- `01:00`
- `00:01:00`
- `00:01:00:12`
- `1m00s`

## Observacoes

- O plugin tenta ativar a sequencia selecionada usando `app.project.openSequence(sequenceID)` antes de cortar.
- Se o Premiere nao conseguir ativar a sequencia, abra a sequencia manualmente na timeline e tente novamente.
- Os cortes sao aplicados via QE API usando `qe.project.getActiveSequence()` somente depois da tentativa de ativacao da sequencia selecionada.
