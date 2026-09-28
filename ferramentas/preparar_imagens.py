"""Tratamento das fotos da casa para as páginas públicas.

Por que existe: o sistema de design da Auster proíbe sombra e canto
arredondado na interface. Tirada a moldura, a foto fica exposta — e foto de
celular, crua, ao lado de tipografia cuidada, denuncia o amadorismo na hora.
A profundidade que a interface não pode dar vem daqui, do ARQUIVO:

  1. recorte com âncora declarada (nada de "centro" por preguiça);
  2. curva em S, para abrir o contraste sem estourar o céu nem fechar a sombra;
  3. sombras puxadas para o azul da marca e realces mantidos neutros —
     é o que faz cinco fotos de dias diferentes parecerem uma série;
  4. vinheta suave, que segura o olho no meio do quadro;
  5. nitidez por máscara de desfoque, depois de reduzir (reduzir sempre borra);
  6. grão fino. Sem ele, céu e parede lisos formam faixas na compressão —
     e é o grão que separa "imagem de banco" de "fotografia".

Rodar:  python ferramentas/preparar_imagens.py
Lê de `07_Originais_Fotos/` (fora do repositório) ou da pasta passada em
`--origem`, e grava em `ativos/imagens/`.
"""

import argparse
import os
from PIL import Image, ImageEnhance, ImageFilter, ImageChops

SAIDA = 'ativos/imagens'

# nome de saída -> (arquivo de origem, proporção, âncora vertical, largura)
#
# A âncora é a fração da altura do original que fica no CENTRO do recorte.
# 0.5 é o meio; menos sobe, mais desce. Cada uma aqui foi escolhida olhando a
# foto, e o comentário diz o porquê — recorte sem motivo é recorte que alguém
# vai desfazer por engano depois.
RECEITAS = {
    # A fachada em 3:2: cabe o letreiro inteiro e sobra céu para o título
    # respirar quando ela vai para a coluna da capa.
    'fachada.jpg': ('Fachada Auster Principal.jpg', (3, 2), 0.52, 1600),
    # A mesma, mais deitada, para o bloco "Onde acontece".
    'fachada-larga.jpg': ('Fachada Auster Principal.jpg', (16, 9), 0.54, 1400),
    # Recepção de frente, em 4:5: a marca na parede fica no terço superior.
    'recepcao.jpg': ('recepcao-auster-frontal.jpg', (4, 5), 0.46, 1000),
    'recepcao-lateral.jpg': ('Recepcao-Auster-lateral.jpg', (4, 5), 0.48, 1000),
}

# Retratos entram por outro caminho: recorte mais alto, para a cabeça não
# encostar na borda, e sem vinheta — vinheta em rosto marca a edição.
RETRATOS = {
    'palestrante.jpg': ('retrato-terno.jpg', (4, 5), 0.42, 900),
    'palestrante-casa.jpg': ('retrato-casa.jpg', (4, 5), 0.44, 900),
}


def recortar(im, proporcao, ancora):
    """Recorta ao máximo que a proporção permite, centrado em `ancora`."""
    alvo = proporcao[0] / proporcao[1]
    larg, alt = im.size
    if larg / alt > alvo:                      # larga demais: corta dos lados
        nova_larg = round(alt * alvo)
        esquerda = (larg - nova_larg) // 2
        caixa = (esquerda, 0, esquerda + nova_larg, alt)
    else:                                      # alta demais: corta em cima/baixo
        nova_alt = round(larg / alvo)
        topo = round(alt * ancora - nova_alt / 2)
        topo = max(0, min(alt - nova_alt, topo))
        caixa = (0, topo, larg, topo + nova_alt)
    return im.crop(caixa)


def curva_em_s(im, forca=0.13):
    """Contraste por curva, não por `Contrast()`.

    `ImageEnhance.Contrast` é uma reta: clareia o que já é claro e queima. A
    curva em S move os meios-tons e deixa as pontas quase onde estavam, que é
    o que um laboratório faz.
    """
    tabela = []
    for i in range(256):
        x = i / 255
        y = x + forca * (x - 0.5) * (1 - abs(2 * x - 1))
        tabela.append(max(0, min(255, round(y * 255))))
    return im.point(tabela * len(im.getbands()))


def esfriar_sombras(im, forca=0.16):
    """Sombras para o azul da marca; realces intocados.

    A máscara é a própria luminância invertida: quanto mais escuro o pixel,
    mais ele recebe do azul. É por isso que o céu não muda de cor.
    """
    vermelho, verde, azul = im.split()
    luz = im.convert('L')
    escuro = luz.point(lambda v: round((255 - v) * forca))
    azul = ImageChops.add(azul, escuro)
    vermelho = ImageChops.subtract(vermelho, escuro.point(lambda v: round(v * 0.45)))
    return Image.merge('RGB', (vermelho, verde, azul))


def vinheta(im, forca=0.22):
    """Escurecimento suave nas bordas, feito por desfoque de um retângulo.

    Um gradiente radial "de verdade" exigiria numpy; o desfoque forte de uma
    máscara branca com borda preta dá a mesma queda e custa nada.
    """
    larg, alt = im.size
    mascara = Image.new('L', (larg, alt), 0)
    margem_x, margem_y = round(larg * 0.16), round(alt * 0.16)
    mascara.paste(255, (margem_x, margem_y, larg - margem_x, alt - margem_y))
    mascara = mascara.filter(ImageFilter.GaussianBlur(min(larg, alt) * 0.18))
    escura = ImageEnhance.Brightness(im).enhance(1 - forca)
    return Image.composite(im, escura, mascara)


def grao(im, forca=7):
    """Grão fino e MONOCROMÁTICO — ruído colorido parece defeito de sensor."""
    larg, alt = im.size
    ruido = Image.effect_noise((larg, alt), forca).convert('L')
    ruido = Image.merge('RGB', (ruido, ruido, ruido))
    return Image.blend(im, ImageChops.overlay(im, ruido), 0.18)


def tratar(origem, destino, proporcao, ancora, largura, com_vinheta=True):
    im = Image.open(origem).convert('RGB')
    im = recortar(im, proporcao, ancora)
    if im.size[0] > largura:
        im = im.resize((largura, round(largura * im.size[1] / im.size[0])), Image.LANCZOS)
    im = curva_em_s(im)
    im = esfriar_sombras(im)
    im = ImageEnhance.Color(im).enhance(0.93)
    if com_vinheta:
        im = vinheta(im)
    # Nitidez DEPOIS de reduzir: reduzir sempre borra, e afiar antes só
    # amplifica o que a redução vai jogar fora.
    im = im.filter(ImageFilter.UnsharpMask(radius=1.4, percent=85, threshold=3))
    im = grao(im)
    caminho = os.path.join(SAIDA, destino)
    im.save(caminho, quality=84, optimize=True, progressive=True)
    return caminho, im.size, os.path.getsize(caminho)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--origem', default='07_Originais_Fotos')
    args = parser.parse_args()
    os.makedirs(SAIDA, exist_ok=True)

    faltando = []
    for tabela, com_vinheta in ((RECEITAS, True), (RETRATOS, False)):
        for destino, (arquivo, proporcao, ancora, largura) in tabela.items():
            origem = os.path.join(args.origem, arquivo)
            if not os.path.exists(origem):
                faltando.append(origem)
                continue
            caminho, tamanho, bytes_ = tratar(origem, destino, proporcao, ancora,
                                              largura, com_vinheta)
            print(f'{destino:24s} {tamanho[0]}x{tamanho[1]}  {round(bytes_/1024)} KB')
    for f in faltando:
        print('ORIGINAL AUSENTE:', f)
    if faltando:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
