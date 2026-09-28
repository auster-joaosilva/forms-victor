"""Gera o motivo gráfico da capa: o símbolo da marca como imagem embutida.

O sistema de design da casa pede "as listras horizontais e os chevrons do
símbolo, recortados num círculo grande que sangra da página". O desenho não é
redesenhado aqui: são os MESMOS cinco traçados de `ativos/favicon.svg`, que
por sua vez saíram do logo oficial. Aproximar a marca à mão é o tipo de erro
que ninguém percebe de perto e todo mundo percebe ao lado do logo de verdade.

A saída vai para `ativos/motivo.txt` (uma linha por cor) e é colada dentro de
`ativos/estilo_publico.css`, no lugar do marcador. O arquivo não é versionado:
é derivado, e derivado que se versiona é derivado que diverge da fonte.

Rodar:  python ferramentas/gerar_motivo.py
"""

import io
import urllib.parse

CORES = {'azul-profundo': '0B3D60', 'azul-claro': '71CFEB'}


def motivo(hexa):
    svg_favicon = io.open('ativos/favicon.svg', encoding='utf-8').read()
    inicio = svg_favicon.index('<path')
    fim = svg_favicon.rindex('</g>')
    tracados = svg_favicon[inicio:fim]
    # A caixa 106 155 81 75 é a do símbolo dentro do sistema de coordenadas do
    # logo original — a mesma que o gerador do favicon mediu com o Chrome.
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="106 155 81 75">'
           '<g fill="COR">' + tracados + '</g></svg>')
    # A cor entra DEPOIS de codificar: `#` vira %23, e codificar de novo o que
    # já está codificado daria %2523, que o navegador não lê.
    codificado = urllib.parse.quote(svg.replace('"', "'"), safe="/:=<>',. -")
    return 'data:image/svg+xml,' + codificado.replace('COR', '%23' + hexa)


def main():
    linhas = [motivo(h) for h in CORES.values()]
    io.open('ativos/motivo.txt', 'w', encoding='utf-8', newline='\n').write(
        '\n'.join(linhas) + '\n')
    for nome, linha in zip(CORES, linhas):
        print(f'{nome:16s} {len(linha)} caracteres')
    print('\nCole a primeira linha no lugar do endereco do motivo em '
          'ativos/estilo_publico.css (.tema-marca::before).')


if __name__ == '__main__':
    main()
