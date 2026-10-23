import React from 'react';
import { ArrowRight } from 'lucide-react';

interface HomePageProps {
  hasCampaign: boolean;
  characterName?: string;
  onStartCharacter: () => void;
  onContinue: () => void;
  onOpenCodex: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  hasCampaign,
  characterName,
  onStartCharacter,
  onContinue,
  onOpenCodex,
}) => {
  return (
    <div className="editorial-page">
      <div className="max-w-[680px]">
        <div className="editorial-eyebrow">Narrativa interativa · Pós-mangá</div>

        <h1 className="editorial-hero-title mt-5 text-[#eee5d4]">
          Crônica de
          <br />
          Jujutsu
        </h1>

        <p className="editorial-lede mt-7 max-w-[560px]">
          Um RPG narrativo para quem deseja entrar no mundo de Jujutsu Kaisen e
          criar a própria história.
        </p>

        <p className="editorial-body mt-7 max-w-[560px]">
          Aqui o Mestre é uma inteligência artificial. Ele narra a cena,
          interpreta quem você encontra e responde a cada decisão — como numa
          mesa de verdade, só que a mesa é sua e a história ainda não foi
          escrita. Sem atributos, sem barras, sem dados: a ficção decide o preço.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          {hasCampaign ? (
            <>
              <button type="button" onClick={onContinue} className="editorial-button">
                Continuar crônica
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onStartCharacter}
                className="editorial-button editorial-button--ghost"
              >
                Nova ficha
              </button>
            </>
          ) : (
            <button type="button" onClick={onStartCharacter} className="editorial-button">
              Criar personagem
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
          <button type="button" onClick={onOpenCodex} className="editorial-link ml-1">
            Explorar o Códice
          </button>
        </div>

        {hasCampaign && characterName && (
          <p className="editorial-muted mt-5 font-sans text-[10px] uppercase tracking-[0.18em]">
            Crônica em andamento · {characterName}
          </p>
        )}

        <div className="mt-20 grid grid-cols-1 gap-8 border-t border-[rgba(201,169,106,0.22)] pt-8 sm:grid-cols-3">
          <div>
            <div className="editorial-numeral">I</div>
            <h2 className="editorial-serif mt-3 text-lg text-[#e7ddcb]">Você escreve</h2>
            <p className="editorial-muted mt-2 font-sans text-[12px] leading-relaxed">
              Descreva o que seu personagem faz, diz ou pensa, com as próprias
              palavras.
            </p>
          </div>
          <div>
            <div className="editorial-numeral">II</div>
            <h2 className="editorial-serif mt-3 text-lg text-[#e7ddcb]">O Mestre narra</h2>
            <p className="editorial-muted mt-2 font-sans text-[12px] leading-relaxed">
              Cenas, rivais e consequências surgem de acordo com a ficha e as
              escolhas.
            </p>
          </div>
          <div>
            <div className="editorial-numeral">III</div>
            <h2 className="editorial-serif mt-3 text-lg text-[#e7ddcb]">A história decide</h2>
            <p className="editorial-muted mt-2 font-sans text-[12px] leading-relaxed">
              Quando o risco é real, o Mestre decide o que o corpo e a alma
              pagam — sem rolagem.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
