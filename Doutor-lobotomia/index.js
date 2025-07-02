// Importando as dependências necessárias
const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");
const sqlite3 = require("sqlite3").verbose();

// Configurar banco de dados
const db = new sqlite3.Database("voicetime.db");

// Criar tabela se não existir
db.run(
  `
  CREATE TABLE IF NOT EXISTS voice_time (
    user_id TEXT PRIMARY KEY,
    total_time INTEGER DEFAULT 0,
    start_time INTEGER DEFAULT 0
  )
`,
  (err) => {
    if (err) {
      logSystem("ERROR", "Erro ao criar tabela:", err);
    } else {
      logSystem("SUCCESS", "Banco de dados inicializado com sucesso");
    }
  },
);

db.run(
  `
  CREATE TABLE IF NOT EXISTS lobotomy_count (
    user_id TEXT PRIMARY KEY,
    lobotomized_count INTEGER DEFAULT 0,
    reversed_count INTEGER DEFAULT 0
  )
`,
  (err) => {
    if (err) {
      logSystem(
        "ERROR",
        "Erro ao criar tabela de contagem de lobotomias:",
        err,
      );
    } else {
      logSystem(
        "SUCCESS",
        "Tabela de contagem de lobotomias inicializada com sucesso",
      );
    }
  },
);

// Tabela para rastrear quem lobotomizou quem
db.run(
  `
  CREATE TABLE IF NOT EXISTS lobotomy_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    executor_id TEXT,
    target_id TEXT,
    action_type TEXT,
    timestamp INTEGER
  )
`,
  (err) => {
    if (err) {
      logSystem("ERROR", "Erro ao criar tabela de ações de lobotomia:", err);
    } else {
      logSystem(
        "SUCCESS",
        "Tabela de ações de lobotomia inicializada com sucesso",
      );
    }
  },
);

// NOVA TABELA: Tabela para diagnósticos ativos
db.run(
  `
  CREATE TABLE IF NOT EXISTS active_diagnoses (
    user_id TEXT PRIMARY KEY,
    diagnosis_name TEXT,
    diagnosis_description TEXT,
    treatment TEXT,
    severity TEXT,
    diagnosed_by TEXT,
    diagnosed_at INTEGER,
    expires_at INTEGER
  )
`,
  (err) => {
    if (err) {
      logSystem("ERROR", "Erro ao criar tabela de diagnósticos ativos:", err);
    } else {
      logSystem(
        "SUCCESS",
        "Tabela de diagnósticos ativos inicializada com sucesso",
      );
    }
  },
);

// NOVA TABELA: Tabela para experimentos ativos
db.run(
  `
  CREATE TABLE IF NOT EXISTS active_experiments (
    user_id TEXT PRIMARY KEY,
    experiment_type TEXT,
    result TEXT,
    side_effect TEXT,
    success_level TEXT,
    experimenter_id TEXT,
    experiment_at INTEGER,
    expires_at INTEGER
  )
`,
  (err) => {
    if (err) {
      logSystem("ERROR", "Erro ao criar tabela de experimentos ativos:", err);
    } else {
      logSystem(
        "SUCCESS",
        "Tabela de experimentos ativos inicializada com sucesso",
      );
    }
  },
);

// NOVA TABELA: Estatísticas de diagnósticos e experimentos
db.run(
  `
  CREATE TABLE IF NOT EXISTS science_stats (
    user_id TEXT PRIMARY KEY,
    diagnosed_count INTEGER DEFAULT 0,
    experimented_count INTEGER DEFAULT 0,
    diagnosis_given_count INTEGER DEFAULT 0,
    experiments_conducted_count INTEGER DEFAULT 0
  )
`,
  (err) => {
    if (err) {
      logSystem(
        "ERROR",
        "Erro ao criar tabela de estatísticas científicas:",
        err,
      );
    } else {
      logSystem(
        "SUCCESS",
        "Tabela de estatísticas científicas inicializada com sucesso",
      );
    }
  },
);

// Sistema de configuração salvo no banco de dados
db.run(
  `
  CREATE TABLE IF NOT EXISTS bot_config (
    guild_id TEXT,
    setting_key TEXT,
    setting_value TEXT,
    PRIMARY KEY (guild_id, setting_key)
  )
`,
  (err) => {
    if (err) {
      logSystem("ERROR", "Erro ao criar tabela de configurações:", err);
    } else {
      logSystem("SUCCESS", "Tabela de configurações inicializada com sucesso");
    }
  },
);

// Tabela para status de relacionamento do Alvim
db.run(
  `
  CREATE TABLE IF NOT EXISTS alvim_relationship (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    status TEXT NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    parceiro TEXT
  )
`,
  (err) => {
    if (err) {
      logSystem(
        "ERROR",
        "Erro ao criar tabela de relacionamento do Alvim:",
        err,
      );
    } else {
      logSystem(
        "SUCCESS",
        "Tabela de relacionamento do Alvim inicializada com sucesso",
      );

      // Verificar se já existe um registro, se não, inserir o registro inicial
      db.get("SELECT * FROM alvim_relationship WHERE id = 1", (err, row) => {
        if (err) {
          logSystem(
            "ERROR",
            "Erro ao verificar status de relacionamento do Alvim:",
            err,
          );
          return;
        }

        if (!row) {
          // Data de nascimento do Alvim (20 de junho de 2002)
          // Definir a data exata para meio-dia para evitar problemas de fuso horário
          const birthDate = new Date(2002, 5, 20, 12, 0, 0, 0).getTime();

          // Inserir registro inicial (solteiro desde o nascimento)
          db.run(
            "INSERT INTO alvim_relationship (id, status, start_time) VALUES (1, 'solteiro', ?)",
            [birthDate],
            (err) => {
              if (err) {
                logSystem(
                  "ERROR",
                  "Erro ao inserir status inicial do Alvim:",
                  err,
                );
              } else {
                logSystem(
                  "SUCCESS",
                  "Status inicial do Alvim configurado: solteiro desde o nascimento",
                );
              }
            },
          );
        }
      });
    }
  },
);

// Função para obter configurações
function getGuildSetting(guildId, key, defaultValue) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT setting_value FROM bot_config WHERE guild_id = ? AND setting_key = ?",
      [guildId, key],
      (err, row) => {
        if (err) reject(err);
        resolve(row ? row.setting_value : defaultValue);
      },
    );
  });
}

// Função para salvar configurações
function setGuildSetting(guildId, key, value) {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT OR REPLACE INTO bot_config (guild_id, setting_key, setting_value) VALUES (?, ?, ?)",
      [guildId, key, value],
      (err) => {
        if (err) reject(err);
        resolve();
      },
    );
  });
}

// Verificar conexão com o banco de dados
db.get(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='voice_time'",
  (err, row) => {
    if (err) {
      logSystem("ERROR", "Erro ao verificar tabelas:", err);
    } else if (!row) {
      logSystem("WARNING", "Tabela voice_time não encontrada");
    } else {
      logSystem("SUCCESS", "Conexão com o banco de dados estabelecida");
    }
  },
);

// Configurando servidor HTTP para UptimeRobot
const express = require("express");
const app = express();
const port = 3000;

app.get("/", (req, res) => {
  res.send("Bot está online!");
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${port}`);
});

const fs = require("fs");

// Função para logs
function logSystem(type, message, error = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type}] ${message}`;
  const logFile = "bot.log";

  // Log no console
  switch (type) {
    case "ERROR":
      console.error("\x1b[31m%s\x1b[0m", logMessage); // Vermelho
      if (error) {
        console.error("\x1b[31m%s\x1b[0m", "Detalhes do erro:", error);
      }
      break;
    case "WARNING":
      console.warn("\x1b[33m%s\x1b[0m", logMessage); // Amarelo
      break;
    case "SUCCESS":
      console.log("\x1b[32m%s\x1b[0m", logMessage); // Verde
      break;
    default:
      console.log("\x1b[36m%s\x1b[0m", logMessage); // Ciano
  }

  // Salvar em arquivo
  fs.appendFileSync(
    logFile,
    logMessage + (error ? "\nError details: " + error : "") + "\n",
  );
}

// Criando uma nova instância do cliente
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// Tratamento de erros global
process.on("unhandledRejection", (error) => {
  logSystem("ERROR", "Erro não tratado:", error);
});

client.on("error", (error) => {
  logSystem("ERROR", "Erro no cliente Discord:", error);
});

// Token do seu bot como variável de ambiente
const TOKEN = process.env.TOKEN;

// Definir comandos slash
const commands = [
  new SlashCommandBuilder()
    .setName("refresh")
    .setDescription("Atualiza os comandos do bot"),
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Responde com Pong!"),
  new SlashCommandBuilder()
    .setName("ola")
    .setDescription("Receba uma saudação personalizada"),
  new SlashCommandBuilder()
    .setName("ajuda")
    .setDescription("Mostra a lista de comandos disponíveis"),
  new SlashCommandBuilder()
    .setName("ranking")
    .setDescription("Mostra o ranking de tempo em call"),
];

// Adicione um novo comando para configurações
commands.push(
  new SlashCommandBuilder()
    .setName("configurar")
    .setDescription("Configura ajustes do bot")
    .addStringOption((option) =>
      option
        .setName("configuracao")
        .setDescription("O ajuste a modificar")
        .setRequired(true)
        .addChoices(
          {
            name: "Duração máxima de experimentos",
            value: "max_experiment_duration",
          },
          {
            name: "Duração máxima de diagnósticos",
            value: "max_diagnosis_duration",
          },
          { name: "Desativar lobotomias", value: "disable_lobotomy" },
        ),
    )
    .addStringOption((option) =>
      option
        .setName("valor")
        .setDescription("O novo valor da configuração")
        .setRequired(true),
    ),
);

// Adicionando o comando "lobotomizar" à lista de comandos
commands.push(
  new SlashCommandBuilder()
    .setName("lobotomizar")
    .setDescription("Realiza uma lobotomia em um nerdola")
    .addUserOption((option) =>
      option
        .setName("alvo")
        .setDescription("Escolha o alvo para lobotomizar")
        .setRequired(true),
    ),
);

// Adicionando o comando "reversao" à lista de comandos
commands.push(
  new SlashCommandBuilder()
    .setName("reversao")
    .setDescription("Reverte a lobotomia de um nerdola")
    .addUserOption((option) =>
      option
        .setName("alvo")
        .setDescription("Escolha o alvo para reverter a lobotomia")
        .setRequired(true),
    ),
);

// Stats de lobotomia
commands.push(
  new SlashCommandBuilder()
    .setName("lobotomia-stats")
    .setDescription("Mostra estatísticas de lobotomias no servidor")
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription(
          "Visualizar estatísticas de um usuário específico (opcional)",
        )
        .setRequired(false),
    ),
);

// Comando "diagnosticar"
commands.push(
  new SlashCommandBuilder()
    .setName("diagnosticar")
    .setDescription("Realiza um diagnóstico mental científico em um nerdola")
    .addUserOption((option) =>
      option
        .setName("paciente")
        .setDescription("Escolha o paciente para diagnosticar")
        .setRequired(true),
    ),
);

// Comando "experimento"
commands.push(
  new SlashCommandBuilder()
    .setName("experimento")
    .setDescription("Realiza um experimento científico em um cobaia")
    .addUserOption((option) =>
      option
        .setName("cobaia")
        .setDescription("Escolha a cobaia para o experimento")
        .setRequired(true),
    ),
);

// Comando "ciencia-stats" para estatísticas de diagnósticos e experimentos
commands.push(
  new SlashCommandBuilder()
    .setName("ciencia-stats")
    .setDescription(
      "Mostra estatísticas de diagnósticos e experimentos no servidor",
    )
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription(
          "Visualizar estatísticas de um usuário específico (opcional)",
        )
        .setRequired(false),
    ),
);

// Comando "status-mental" para ver diagnósticos e experimentos ativos
commands.push(
  new SlashCommandBuilder()
    .setName("status-mental")
    .setDescription("Mostra o estado mental atual de um usuário")
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription(
          "Usuário para verificar (opcional, se não especificado mostra o seu)",
        )
        .setRequired(false),
    ),
);

// Comando "curar" para remover um diagnóstico ou efeito de experimento
commands.push(
  new SlashCommandBuilder()
    .setName("curar")
    .setDescription(
      "Cura um usuário de sua condição mental ou efeitos de experimentos",
    )
    .addUserOption((option) =>
      option
        .setName("paciente")
        .setDescription("Paciente a ser curado")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("tipo")
        .setDescription("Tipo de cura")
        .setRequired(true)
        .addChoices(
          { name: "Diagnóstico", value: "diagnosis" },
          { name: "Experimento", value: "experiment" },
          { name: "Ambos", value: "both" },
        ),
    ),
);
// Comando "contagem-alvim"
commands.push(
  new SlashCommandBuilder()
    .setName("contagem-alvim")
    .setDescription(
      "Mostra há quanto tempo o Alvim está solteiro ou namorando",
    ),
);

// Comando "alvim-namorando"
commands.push(
  new SlashCommandBuilder()
    .setName("alvim-namorando")
    .setDescription("Define que o Alvim começou a namorar")
    .addStringOption((option) =>
      option
        .setName("parceiro")
        .setDescription("Nome do parceiro(a) do Alvim")
        .setRequired(true),
    ),
);

// Comando "alvim-terminou"
commands.push(
  new SlashCommandBuilder()
    .setName("alvim-terminou")
    .setDescription(
      "Define que o Alvim terminou o namoro e voltou a ficar solteiro",
    ),
);
// Comando "alvim-corrigir-data"
commands.push(
  new SlashCommandBuilder()
    .setName("alvim-corrigir-data")
    .setDescription("Corrige a data de início do status de solteiro do Alvim")
    .setDefaultMemberPermissions(0), // Apenas administradores
);

// Registrar comandos slash
const rest = new REST().setToken(TOKEN);

// Escolha APENAS UM dos métodos de registro de comandos abaixo:
// Removendo o registro global para evitar comandos duplicados
// Deixando apenas o registro para o servidor específico

// Função para atualizar contadores de estatísticas
function updateScienceStats(userId, type) {
  db.run(
    "INSERT OR IGNORE INTO science_stats (user_id, diagnosed_count, experimented_count, diagnosis_given_count, experiments_conducted_count) VALUES (?, 0, 0, 0, 0)",
    [userId],
  );

  let updateField = "";
  switch (type) {
    case "diagnosed":
      updateField = "diagnosed_count = diagnosed_count + 1";
      break;
    case "experimented":
      updateField = "experimented_count = experimented_count + 1";
      break;
    case "diagnosis_given":
      updateField = "diagnosis_given_count = diagnosis_given_count + 1";
      break;
    case "experiment_conducted":
      updateField =
        "experiments_conducted_count = experiments_conducted_count + 1";
      break;
  }

  if (updateField) {
    db.run(`UPDATE science_stats SET ${updateField} WHERE user_id = ?`, [
      userId,
    ]);
  }
}

// Função para verificar e remover condições expiradas
function checkExpiredConditions() {
  const currentTime = Date.now();

  // Remover diagnósticos expirados
  db.all(
    "SELECT * FROM active_diagnoses WHERE expires_at <= ?",
    [currentTime],
    (err, rows) => {
      if (err) {
        logSystem("ERROR", "Erro ao verificar diagnósticos expirados:", err);
        return;
      }

      rows.forEach((row) => {
        db.run("DELETE FROM active_diagnoses WHERE user_id = ?", [row.user_id]);
        logSystem(
          "INFO",
          `Diagnóstico expirado removido para usuário ${row.user_id}`,
        );
      });
    },
  );

  // Remover experimentos expirados
  db.all(
    "SELECT * FROM active_experiments WHERE expires_at <= ?",
    [currentTime],
    (err, rows) => {
      if (err) {
        logSystem("ERROR", "Erro ao verificar experimentos expirados:", err);
        return;
      }

      rows.forEach((row) => {
        db.run("DELETE FROM active_experiments WHERE user_id = ?", [
          row.user_id,
        ]);
        logSystem(
          "INFO",
          `Experimento expirado removido para usuário ${row.user_id}`,
        );
      });
    },
  );
}

// Verificar condições expiradas a cada 5 minutos
setInterval(checkExpiredConditions, 5 * 60 * 1000);

// Quando o bot estiver pronto
client.once(Events.ClientReady, (readyClient) => {
  logSystem("SUCCESS", `Bot está online como ${readyClient.user.tag}!`);
  logSystem("INFO", `Conectado em ${client.guilds.cache.size} servidores`);

  // Log das permissões do bot
  client.guilds.cache.forEach((guild) => {
    const botMember = guild.members.cache.get(client.user.id);
    logSystem(
      "INFO",
      `Permissões no servidor ${guild.name}:`,
      Array.from(botMember.permissions.toArray()),
    );
  });

  // Verificar condições expiradas ao iniciar
  checkExpiredConditions();
});

// Função para atualizar tempo em tempo real
function updateVoiceTime() {
  client.guilds.cache.forEach((guild) => {
    guild.channels.cache.forEach((channel) => {
      if (channel.type === 2) {
        // 2 é o tipo de canal de voz
        channel.members.forEach((member) => {
          const userId = member.user.id;
          db.get(
            "SELECT * FROM voice_time WHERE user_id = ?",
            [userId],
            (err, row) => {
              if (row && row.start_time > 0) {
                const currentTime = Date.now();
                const timeToAdd = currentTime - row.start_time;
                const newTotal = (row.total_time || 0) + timeToAdd;

                console.log(
                  `Atualizando tempo para ${member.user.username}: +${Math.floor(timeToAdd / 1000)}s`,
                );

                // Atualiza o tempo total e define um novo start_time
                db.run(
                  "UPDATE voice_time SET total_time = ?, start_time = ? WHERE user_id = ?",
                  [newTotal, currentTime, userId],
                );
              }
            },
          );
        });
      }
    });
  });
}

// Iniciar atualização periódica
setInterval(updateVoiceTime, 30000); // Atualiza a cada 30 segundos

// Evento para quando alguém entra em uma chamada
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  const userId = newState.member.user.id;

  // Usuário entrou em uma chamada
  if (!oldState.channelId && newState.channelId) {
    const startTime = Date.now();
    db.run(
      "INSERT OR IGNORE INTO voice_time (user_id, total_time, start_time) VALUES (?, 0, ?)",
      [userId, startTime],
      (err) => {
        if (!err) {
          db.run("UPDATE voice_time SET start_time = ? WHERE user_id = ?", [
            startTime,
            userId,
          ]);
        }
      },
    );
  }

  // Usuário saiu de uma chamada
  if (oldState.channelId && !newState.channelId) {
    db.get(
      "SELECT * FROM voice_time WHERE user_id = ?",
      [userId],
      (err, row) => {
        if (row && row.start_time > 0) {
          const sessionTime = Date.now() - row.start_time;
          const newTotal = row.total_time + sessionTime;
          db.run(
            "UPDATE voice_time SET total_time = ?, start_time = 0 WHERE user_id = ?",
            [newTotal, userId],
          );
        }
      },
    );
  }
});

// Evento para lidar com interações de comando
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  logSystem(
    "INFO",
    `Comando "/${interaction.commandName}" executado por ${interaction.user.username} no canal #${interaction.channel.name}`,
  );

  try {
    switch (interaction.commandName) {
      case "refresh":
        await interaction.deferReply();
        try {
          await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
            body: commands,
          });
          await interaction.editReply("✅ Comandos atualizados com sucesso!");
        } catch (error) {
          logSystem("ERROR", "Erro ao atualizar comandos:", error);
          await interaction.editReply("❌ Erro ao atualizar comandos!");
        }
        break;

      case "ping":
        await interaction.reply("Pong!");
        break;

      case "ola":
        await interaction.reply(`Olá, ${interaction.user.username}!`);
        break;

     case "ajuda":
        const helpEmbed = new EmbedBuilder()
          .setTitle("🧠 **DOUTOR LOBOTOMIA** - Central de Comandos")
          .setDescription("*Bem-vindo ao laboratório científico mais avançado do Discord!*\n\n**Selecione uma categoria abaixo para explorar os comandos:**")
          .setColor(0x00CED1)
          .setThumbnail(interaction.client.user.displayAvatarURL())
          .addFields(
            {
              name: "🏥 **OPERAÇÕES MÉDICAS**",
              value: "> `/lobotomizar` - Realize uma lobotomia científica\n" +
                     "> `/reversao` - Reverta os efeitos de uma lobotomia\n" +
                     "> `/diagnosticar` - Diagnóstico mental avançado\n" +
                     "> `/experimento` - Conduza experimentos científicos\n" +
                     "> `/curar` - Remova efeitos de diagnósticos/experimentos",
              inline: false
            },
            {
              name: "📊 **ESTATÍSTICAS & RANKINGS**",
              value: "> `/ranking` - Ranking de tempo em call do servidor\n" +
                     "> `/lobotomia-stats` - Estatísticas detalhadas de lobotomias\n" +
                     "> `/ciencia-stats` - Relatório de diagnósticos e experimentos\n" +
                     "> `/status-mental` - Verificar condições mentais ativas",
              inline: false
            },
            {
              name: "🎭 **DIVERSÃO & INTERAÇÃO**",
              value: "> `/ola` - Receba uma saudação personalizada\n" +
                     "> `/ping` - Teste a latência do bot",
              inline: false
            },
            {
              name: "👨‍💼 **ÁREA ADMINISTRATIVA**",
              value: "> `/configurar` - Ajustes avançados do bot\n" +
                     "> `/refresh` - Atualizar comandos do sistema\n" +
                     "> `/limpar-comandos` - Reset completo de comandos",
              inline: false
            }
          )
          .setFooter({ 
            text: `Solicitado por ${interaction.user.username} • Doutor Lobotomia v2.0`,
            iconURL: interaction.user.displayAvatarURL() 
          })
          .setTimestamp();

        const helpButtons = [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 1,
                customId: "help_medical",
                emoji: "🏥",
                label: "Médico"
              },
              {
                type: 2,
                style: 1,
                customId: "help_stats",
                emoji: "📊", 
                label: "Stats"
              },
              {
                type: 2,
                style: 1,
                customId: "help_fun",
                emoji: "🎭",
                label: "Diversão"
              },
              {
                type: 2,
                style: 2,
                customId: "help_admin",
                emoji: "👨‍💼",
                label: "Admin"
              }
            ]
          }
        ];

        const helpMessage = await interaction.reply({
          embeds: [helpEmbed],
          components: helpButtons,
          fetchReply: true
        });

        // Collector com try/catch para evitar erros
        const helpCollector = helpMessage.createMessageComponentCollector({
          time: 300000
        });

        helpCollector.on('collect', async (i) => {
          try {
            // Verificar se a interação ainda é válida
            if (i.deferred || i.replied) return;

            if (i.user.id !== interaction.user.id) {
              await i.reply({
                content: "Apenas quem solicitou a ajuda pode navegar pelos menus!",
                ephemeral: true
              });
              return;
            }

            // Handler para voltar ao menu principal
            if (i.customId === "help_back") {
              await i.update({
                embeds: [helpEmbed],
                components: helpButtons
              });
              return;
            }

            let categoryEmbed;
            
            switch (i.customId) {
              case "help_medical":
                categoryEmbed = new EmbedBuilder()
                  .setTitle("🏥 **OPERAÇÕES MÉDICAS DISPONÍVEIS**")
                  .setDescription("*Arsenal completo de procedimentos científicos do Doutor Lobotomia*")
                  .setColor(0xFF6B6B)
                  .addFields(
                    {
                      name: "🧠 `/lobotomizar @usuário`",
                      value: "**Descrição:** Realiza uma lobotomia científica recreativa\n**Uso:** Diversão entre amigos\n**Efeito:** Contador permanente de lobotomias",
                      inline: false
                    },
                    {
                      name: "🔄 `/reversao @usuário`", 
                      value: "**Descrição:** Reverte os efeitos de uma lobotomia anterior\n**Uso:** 'Cura' uma lobotomia\n**Efeito:** Contador de reversões",
                      inline: false
                    },
                    {
                      name: "🔬 `/diagnosticar @usuário`",
                      value: "**Descrição:** Fornece um diagnóstico mental hilário\n**Uso:** Diagnósticos temporários engraçados\n**Duração:** Configurável pelo admin",
                      inline: false
                    },
                    {
                      name: "⚗️ `/experimento @usuário`",
                      value: "**Descrição:** Conduz experimentos científicos seguros\n**Uso:** Efeitos temporários criativos\n**Duração:** Configurável pelo admin",
                      inline: false
                    },
                    {
                      name: "💊 `/curar @usuário`",
                      value: "**Descrição:** Remove diagnósticos ou experimentos ativos\n**Uso:** Limpar efeitos temporários\n**Opções:** Diagnóstico ou Experimento",
                      inline: false
                    }
                  )
                  .setFooter({ text: "Clique em 'Voltar' para retornar ao menu principal" });
                break;

              case "help_stats":
                categoryEmbed = new EmbedBuilder()
                  .setTitle("📊 **CENTRO DE ESTATÍSTICAS**")
                  .setDescription("*Dados científicos e rankings do laboratório*")
                  .setColor(0x4ECDC4)
                  .addFields(
                    {
                      name: "🏆 `/ranking`",
                      value: "**Funcionalidade:** Mostra ranking de tempo em call\n**Recursos:** Navegação por páginas, filtro de bots\n**Dados:** Horas, minutos e segundos precisos",
                      inline: false
                    },
                    {
                      name: "🧠 `/lobotomia-stats [@usuário]`",
                      value: "**Individual:** Estatísticas pessoais de lobotomias\n**Servidor:** Ranking geral de lobotomizados\n**Inclui:** Lobotomias recebidas/realizadas",
                      inline: false
                    },
                    {
                      name: "🔬 `/ciencia-stats [@usuário]`",
                      value: "**Dados:** Diagnósticos e experimentos\n**Estatísticas:** Recebidos e realizados\n**Período:** Histórico completo",
                      inline: false
                    },
                    {
                      name: "🧪 `/status-mental [@usuário]`",
                      value: "**Verifica:** Diagnósticos ativos\n**Mostra:** Experimentos em andamento\n**Tempo:** Restante para expiração",
                      inline: false
                    }
                  )
                  .setFooter({ text: "Use @ para ver stats de outros usuários" });
                break;

              case "help_fun":
                categoryEmbed = new EmbedBuilder()
                  .setTitle("🎭 **CENTRO DE DIVERSÃO**")
                  .setDescription("*Entretenimento científico garantido!*")
                  .setColor(0xFFE66D)
                  .addFields(
            
                    {
                      name: "👋 `/ola`",
                      value: "**Saudação:** Cumprimento personalizado\n**Uso:** Interação amigável\n**Resposta:** Menciona seu nome",
                      inline: false
                    },
                    {
                      name: "🏓 `/ping`",
                      value: "**Teste:** Verifica latência do bot\n**Resposta:** Simples 'Pong!'\n**Uso:** Diagnóstico de conexão",
                      inline: false
                    }
                  )
                  .setFooter({ text: "Diversão responsável e científica!" });
                break;

              case "help_admin":
                categoryEmbed = new EmbedBuilder()
                  .setTitle("👨‍💼 **PAINEL ADMINISTRATIVO**")
                  .setDescription("*Ferramentas de gerenciamento do laboratório*")
                  .setColor(0x9B59B6)
                  .addFields(
                    {
                      name: "⚙️ `/configurar`",
                      value: "**Permissão:** Apenas administradores\n**Opções:** Duração de experimentos/diagnósticos\n**Configurações:** Desativar funcionalidades",
                      inline: false
                    },
                    {
                      name: "🔄 `/refresh`",
                      value: "**Função:** Atualiza comandos do bot\n**Uso:** Após atualizações do código\n**Efeito:** Re-registra comandos slash",
                      inline: false
                    },
                    {
                      name: "🧹 `/limpar-comandos`",
                      value: "**Permissão:** Apenas administradores\n**Função:** Remove comandos duplicados\n**Uso:** Limpeza de sistema",
                      inline: false
                    }
                  )
                  .setFooter({ text: "Use com responsabilidade - Poder científico!" });
                break;
            }

            const backButton = [
              {
                type: 1,
                components: [
                  {
                    type: 2,
                    style: 2,
                    customId: "help_back",
                    emoji: "◀️",
                    label: "Voltar ao Menu"
                  }
                ]
              }
            ];

            await i.update({
              embeds: [categoryEmbed],
              components: backButton
            });

          } catch (error) {
            console.error('Erro no collector de ajuda:', error);
            // Não tentar responder novamente se já houve erro
          }
        });

        helpCollector.on('end', () => {
          try {
            const disabledButtons = [
              {
                type: 1,
                components: helpButtons[0].components.map(button => ({
                  ...button,
                  disabled: true
                }))
              }
            ];

            helpMessage.edit({ components: disabledButtons }).catch(() => {});
          } catch (error) {
            console.error('Erro ao desabilitar botões:', error);
          }
        });

        break;
      case "limpar-comandos":
        // Verificar permissões
        if (!interaction.member.permissions.has("ADMINISTRATOR")) {
          await interaction.reply({
            content: "Você não tem permissão para usar este comando!",
            ephemeral: true,
          });
          return;
        }

        await interaction.deferReply({ ephemeral: true });

        try {
          // Limpar comandos globais
          await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), {
            body: [],
          });

          // Limpar comandos do servidor específico
          await rest.put(
            Routes.applicationGuildCommands(
              process.env.CLIENT_ID,
              interaction.guild.id,
            ),
            { body: [] },
          );

          await interaction.editReply(
            "✅ Todos os comandos foram removidos! Agora vou registrar novamente sem duplicatas...",
          );

          // Registrar comandos apenas para este servidor
          await rest.put(
            Routes.applicationGuildCommands(
              process.env.CLIENT_ID,
              interaction.guild.id,
            ),
            { body: commands },
          );

          await interaction.followUp({
            content:
              "✅ Comandos registrados com sucesso para este servidor! Os comandos duplicados devem ter desaparecido.",
            ephemeral: true,
          });
        } catch (error) {
          console.error(error);
          await interaction.editReply(
            `❌ Erro ao limpar comandos: ${error.message}`,
          );
        }
        break;

      case "ranking":
        // Coletar dados de todos os usuários com tempo de voz registrado
        db.all(
          "SELECT * FROM voice_time ORDER BY total_time DESC",
          [],
          async (err, allRows) => {
            if (err) {
              logSystem("ERROR", "Erro ao buscar dados de tempo em call:", err);
              await interaction.reply("Erro ao gerar ranking!");
              return;
            }

            // Função para criar embed com páginas
            async function createRankingEmbed(page = 1, allUsers) {
              // Filtrar bots da lista
              const membersWithRoles = await Promise.all(
                allUsers.map(async (row) => {
                  try {
                    const member = await interaction.guild.members.fetch(
                      row.user_id,
                    );
                    // Verificar se é bot por role ou pelo flag do Discord
                    const isBot =
                      member.roles.cache.some(
                        (role) => role.name.toLowerCase() === "bot",
                      ) || member.user.bot;

                    if (!isBot) {
                      const name = member.nickname || member.user.username;
                      const hours = Math.floor(row.total_time / 3600000);
                      const minutes = Math.floor(
                        (row.total_time % 3600000) / 60000,
                      );
                      const seconds = Math.floor(
                        (row.total_time % 60000) / 1000,
                      );
                      return {
                        id: row.user_id,
                        name,
                        hours,
                        minutes,
                        seconds,
                        totalTime: row.total_time,
                        rank: 0, // Será preenchido depois
                      };
                    }
                    return null;
                  } catch (error) {
                    return null; // Ignorar usuários que não são mais encontrados no servidor
                  }
                }),
              );

              // Remover nulls e atribuir ranks
              const filteredMembers = membersWithRoles
                .filter((m) => m !== null)
                .sort((a, b) => b.totalTime - a.totalTime);

              // Atribuir ranks (posições)
              filteredMembers.forEach((member, index) => {
                member.rank = index + 1;
              });

              // Configurar paginação
              const itemsPerPage = 10;
              const maxPages = Math.ceil(filteredMembers.length / itemsPerPage);
              const currentPage = Math.max(1, Math.min(page, maxPages));
              const startIndex = (currentPage - 1) * itemsPerPage;
              const pageUsers = filteredMembers.slice(
                startIndex,
                startIndex + itemsPerPage,
              );

              // Formatar a lista para esta página
              let rankingList = pageUsers
                .map((member) => {
                  // Determinar emojis para os 3 primeiros colocados
                  let rankEmoji = `${member.rank}.`;
                  if (member.rank === 1) rankEmoji = "🥇";
                  else if (member.rank === 2) rankEmoji = "🥈";
                  else if (member.rank === 3) rankEmoji = "🥉";

                  // Formatar o tempo
                  let timeDisplay = "";
                  if (member.hours > 0) timeDisplay += `${member.hours}h `;
                  if (member.minutes > 0) timeDisplay += `${member.minutes}m `;
                  if (member.seconds > 0 && member.hours === 0)
                    timeDisplay += `${member.seconds}s`;
                  if (timeDisplay === "") timeDisplay = "0s";

                  return `${rankEmoji} **${member.name}**: ${timeDisplay}`;
                })
                .join("\n");

              if (rankingList.length === 0) {
                rankingList = "Nenhum registro de tempo em call encontrado!";
              }

              // Criar embed para esta página
              const embed = new EmbedBuilder()
                .setTitle("🏆 Ranking de Tempo em Lobotocall")
                .setColor(0x0099ff)
                .setDescription(rankingList)
                .setFooter({
                  text: `Página ${currentPage}/${maxPages} • Total: ${filteredMembers.length} membros`,
                })
                .setTimestamp();

              return {
                embed,
                maxPages,
                currentPage,
              };
            }

            // Iniciar com a primeira página
            const initialRanking = await createRankingEmbed(1, allRows);

            // Enviar a mensagem inicial com reações para navegação
            const message = await interaction.reply({
              embeds: [initialRanking.embed],
              fetchReply: true,
              components: [
                {
                  type: 1, // ActionRow
                  components: [
                    {
                      type: 2, // Button
                      style: 2, // Secondary style (grey)
                      customId: "prev_page",
                      emoji: "⬅️",
                      disabled: initialRanking.currentPage === 1,
                    },
                    {
                      type: 2, // Button
                      style: 2, // Secondary style (grey)
                      customId: "next_page",
                      emoji: "➡️",
                      disabled:
                        initialRanking.currentPage === initialRanking.maxPages,
                    },
                  ],
                },
              ],
            });

            // Criar collector para botões de navegação
            const filter = (i) =>
              (i.customId === "prev_page" || i.customId === "next_page") &&
              i.user.id === interaction.user.id;

            const collector = message.createMessageComponentCollector({
              filter,
              time: 300000, // 5 minutos
            });

            let currentPage = 1;

            // Responder aos cliques nos botões
            collector.on("collect", async (i) => {
              if (i.customId === "prev_page") {
                currentPage--;
              } else if (i.customId === "next_page") {
                currentPage++;
              }

              // Atualizar o embed com a nova página
              const updatedRanking = await createRankingEmbed(
                currentPage,
                allRows,
              );

              // Atualizar os botões baseado na página atual
              const updatedComponents = [
                {
                  type: 1, // ActionRow
                  components: [
                    {
                      type: 2, // Button
                      style: 2, // Secondary style
                      customId: "prev_page",
                      emoji: "⬅️",
                      disabled: updatedRanking.currentPage === 1,
                    },
                    {
                      type: 2, // Button
                      style: 2, // Secondary style
                      customId: "next_page",
                      emoji: "➡️",
                      disabled:
                        updatedRanking.currentPage === updatedRanking.maxPages,
                    },
                  ],
                },
              ];

              // Responder à interação do botão
              await i.update({
                embeds: [updatedRanking.embed],
                components: updatedComponents,
              });
            });

            // Quando o tempo do collector expirar
            collector.on("end", () => {
              // Desabilitar botões quando expirar
              const disabledComponents = [
                {
                  type: 1,
                  components: [
                    {
                      type: 2,
                      style: 2,
                      customId: "prev_page",
                      emoji: "⬅️",
                      disabled: true,
                    },
                    {
                      type: 2,
                      style: 2,
                      customId: "next_page",
                      emoji: "➡️",
                      disabled: true,
                    },
                  ],
                },
              ];

              message.edit({ components: disabledComponents }).catch(() => {});
            });
          },
        );
        break;
      case "configurar":
        // Verificar permissões
        if (!interaction.member.permissions.has("ADMINISTRATOR")) {
          await interaction.reply({
            content: "Você não tem permissão para usar este comando!",
            ephemeral: true,
          });
          return;
        }

        const settingKey = interaction.options.getString("configuracao");
        const settingValue = interaction.options.getString("valor");

        await setGuildSetting(interaction.guild.id, settingKey, settingValue);
        await interaction.reply(
          `Configuração '${settingKey}' atualizada para '${settingValue}'`,
        );
        break;

      case "lobotomizar":
        const alvo = interaction.options.getUser("alvo");
        if (!alvo) {
          await interaction.reply({
            content: "Você precisa escolher um alvo para lobotomizar!",
            ephemeral: true,
          });
          return;
        }

        // Registra na tabela de contagem
        db.run(
          "INSERT OR IGNORE INTO lobotomy_count (user_id, lobotomized_count, reversed_count) VALUES (?, 0, 0)",
          [alvo.id],
        );
        db.run(
          "UPDATE lobotomy_count SET lobotomized_count = lobotomized_count + 1 WHERE user_id = ?",
          [alvo.id],
        );

        // Registra a ação
        db.run(
          "INSERT INTO lobotomy_actions (executor_id, target_id, action_type, timestamp) VALUES (?, ?, ?, ?)",
          [interaction.user.id, alvo.id, "lobotomizar", Date.now()],
        );

        // Buscar estatísticas de lobotomia do alvo
        db.get(
          "SELECT lobotomized_count FROM lobotomy_count WHERE user_id = ?",
          [alvo.id],
          async (err, row) => {
            if (err) {
              logSystem("ERROR", "Erro ao buscar contagem de lobotomias:", err);
              return;
            }

            const lobotomiaCount = row ? row.lobotomized_count : 1;
            const mensagem = `${interaction.user.toString()} realizou uma lobotomia no nerdola do ${alvo.toString()}\n\n*${alvo.username} já sofreu ${lobotomiaCount} lobotomia(s) no total!*`;
            const imagem = "./Lobotomia.png";

            const message = await interaction.reply({
              content: mensagem,
              files: [imagem],
              fetchReply: true,
            });

            // Adicionar reações automáticas
            try {
              await message.react("🧠");
              await message.react("🔪");
            } catch (error) {
              logSystem("ERROR", "Erro ao adicionar reações:", error);
            }
          },
        );
        break;

      case "reversao":
        const alvoReversao = interaction.options.getUser("alvo");
        if (!alvoReversao) {
          await interaction.reply({
            content: "Você precisa escolher um alvo para reverter a lobotomia!",
            ephemeral: true,
          });
          return;
        }

        // Registra na tabela de contagem
        db.run(
          "INSERT OR IGNORE INTO lobotomy_count (user_id, lobotomized_count, reversed_count) VALUES (?, 0, 0)",
          [alvoReversao.id],
        );
        db.run(
          "UPDATE lobotomy_count SET reversed_count = reversed_count + 1 WHERE user_id = ?",
          [alvoReversao.id],
        );

        // Registra a ação
        db.run(
          "INSERT INTO lobotomy_actions (executor_id, target_id, action_type, timestamp) VALUES (?, ?, ?, ?)",
          [interaction.user.id, alvoReversao.id, "reversao", Date.now()],
        );

        // Buscar estatísticas de reversão do alvo
        db.get(
          "SELECT reversed_count FROM lobotomy_count WHERE user_id = ?",
          [alvoReversao.id],
          async (err, row) => {
            if (err) {
              logSystem("ERROR", "Erro ao buscar contagem de reversões:", err);
              return;
            }

            const reversaoCount = row ? row.reversed_count : 1;
            const mensagemReversao = `${interaction.user.toString()} reverteu a lobotomia do nerdola ${alvoReversao.toString()}\n\n*${alvoReversao.username} já teve ${reversaoCount} lobotomia(s) revertida(s) no total!*`;
            const imagemReversao = "./Reversao.png";

            const message = await interaction.reply({
              content: mensagemReversao,
              files: [imagemReversao],
              fetchReply: true,
            });

            // Adicionar reações automáticas
            try {
              await message.react("🧠");
              await message.react("💊");
            } catch (error) {
              logSystem("ERROR", "Erro ao adicionar reações:", error);
            }
          },
        );
        break;

      case "lobotomia-stats":
        const usuarioEspecifico = interaction.options.getUser("usuario");
        if (usuarioEspecifico) {
          // Estatísticas de um usuário específico
          db.get(
            "SELECT * FROM lobotomy_count WHERE user_id = ?",
            [usuarioEspecifico.id],
            async (err, row) => {
              if (err) {
                logSystem(
                  "ERROR",
                  "Erro ao buscar estatísticas de lobotomia:",
                  err,
                );
                await interaction.reply("Erro ao buscar estatísticas!");
                return;
              }

              // Buscar quantas lobotomias o usuário realizou
              db.get(
                "SELECT COUNT(*) as count FROM lobotomy_actions WHERE executor_id = ? AND action_type = 'lobotomizar'",
                [usuarioEspecifico.id],
                async (err, executedLobotomies) => {
                  if (err) {
                    logSystem(
                      "ERROR",
                      "Erro ao buscar lobotomias executadas:",
                      err,
                    );
                    return;
                  }

                  // Buscar quantas reversões o usuário realizou
                  db.get(
                    "SELECT COUNT(*) as count FROM lobotomy_actions WHERE executor_id = ? AND action_type = 'reversao'",
                    [usuarioEspecifico.id],
                    async (err, executedReversals) => {
                      if (err) {
                        logSystem(
                          "ERROR",
                          "Erro ao buscar reversões executadas:",
                          err,
                        );
                        return;
                      }

                      const statsEmbed = new EmbedBuilder()
                        .setTitle(
                          `🧠 Estatísticas de Lobotomia - ${usuarioEspecifico.username}`,
                        )
                        .setColor(0x00ffff)
                        .setThumbnail(usuarioEspecifico.displayAvatarURL())
                        .addFields(
                          {
                            name: "Lobotomias Recebidas",
                            value: `${row ? row.lobotomized_count : 0}`,
                            inline: true,
                          },
                          {
                            name: "Reversões Recebidas",
                            value: `${row ? row.reversed_count : 0}`,
                            inline: true,
                          },
                          {
                            name: "Lobotomias Realizadas",
                            value: `${executedLobotomies ? executedLobotomies.count : 0}`,
                            inline: true,
                          },
                          {
                            name: "Reversões Realizadas",
                            value: `${executedReversals ? executedReversals.count : 0}`,
                            inline: true,
                          },
                        );

                      await interaction.reply({ embeds: [statsEmbed] });
                    },
                  );
                },
              );
            },
          );
        } else {
          // Ranking geral
          db.all(
            "SELECT user_id, lobotomized_count, reversed_count FROM lobotomy_count ORDER BY lobotomized_count DESC LIMIT 5",
            [],
            async (err, rows) => {
              if (err) {
                logSystem(
                  "ERROR",
                  "Erro ao buscar ranking de lobotomias:",
                  err,
                );
                await interaction.reply("Erro ao buscar estatísticas!");
                return;
              }

              // Top lobotomizadores
              db.all(
                `SELECT executor_id, COUNT(*) as count FROM lobotomy_actions 
                                 WHERE action_type = 'lobotomizar' 
                                 GROUP BY executor_id 
                                 ORDER BY count DESC 
                                 LIMIT 5`,
                [],
                async (err, topLobotomizers) => {
                  if (err) {
                    logSystem(
                      "ERROR",
                      "Erro ao buscar top lobotomizadores:",
                      err,
                    );
                    return;
                  }

                  // Top reversores
                  db.all(
                    `SELECT executor_id, COUNT(*) as count FROM lobotomy_actions 
                                     WHERE action_type = 'reversao' 
                                     GROUP BY executor_id 
                                     ORDER BY count DESC 
                                     LIMIT 5`,
                    [],
                    async (err, topReversers) => {
                      if (err) {
                        logSystem(
                          "ERROR",
                          "Erro ao buscar top reversores:",
                          err,
                        );
                        return;
                      }

                      // Formatar listas de ranking
                      const lobotomizedRanking = await Promise.all(
                        rows.map(async (row, index) => {
                          const member = await interaction.guild.members
                            .fetch(row.user_id)
                            .catch(() => null);
                          const name = member
                            ? member.nickname || member.user.username
                            : "Usuário Desconhecido";
                          return `${index + 1}. ${name}: ${row.lobotomized_count} lobotomias recebidas`;
                        }),
                      );

                      const topLobotomizersRanking = await Promise.all(
                        topLobotomizers.map(async (row, index) => {
                          const member = await interaction.guild.members
                            .fetch(row.executor_id)
                            .catch(() => null);
                          const name = member
                            ? member.nickname || member.user.username
                            : "Usuário Desconhecido";
                          return `${index + 1}. ${name}: ${row.count} lobotomias realizadas`;
                        }),
                      );

                      const topReversersRanking = await Promise.all(
                        topReversers.map(async (row, index) => {
                          const member = await interaction.guild.members
                            .fetch(row.executor_id)
                            .catch(() => null);
                          const name = member
                            ? member.nickname || member.user.username
                            : "Usuário Desconhecido";
                          return `${index + 1}. ${name}: ${row.count} reversões realizadas`;
                        }),
                      );

                      const rankingEmbed = new EmbedBuilder()
                        .setTitle("🧠 Ranking de Lobotomia do Servidor")
                        .setColor(0x00ffff)
                        .addFields(
                          {
                            name: "🔪 Top Lobotomizados",
                            value:
                              lobotomizedRanking.length > 0
                                ? lobotomizedRanking.join("\n")
                                : "Nenhum registro ainda!",
                            inline: false,
                          },
                          {
                            name: "🩹 Top Lobotomizadores",
                            value:
                              topLobotomizersRanking.length > 0
                                ? topLobotomizersRanking.join("\n")
                                : "Nenhum registro ainda!",
                            inline: false,
                          },
                          {
                            name: "🧩 Top Reversores",
                            value:
                              topReversersRanking.length > 0
                                ? topReversersRanking.join("\n")
                                : "Nenhum registro ainda!",
                            inline: false,
                          },
                        );

                      await interaction.reply({ embeds: [rankingEmbed] });
                    },
                  );
                },
              );
            },
          );
        }
        break;

      case "diagnosticar":
        const paciente = interaction.options.getUser("paciente");
        if (!paciente) {
          await interaction.reply({
            content: "Você precisa escolher um paciente para diagnosticar!",
            ephemeral: true,
          });
          return;
        }

        // Verificar se o paciente já tem um diagnóstico ativo
        db.get(
          "SELECT * FROM active_diagnoses WHERE user_id = ?",
          [paciente.id],
          async (err, existingDiagnosis) => {
            if (err) {
              logSystem(
                "ERROR",
                "Erro ao verificar diagnóstico existente:",
                err,
              );
              return;
            }

            if (existingDiagnosis) {
              await interaction.reply({
                content: `${paciente.username} já possui um diagnóstico ativo: **${existingDiagnosis.diagnosis_name}**. Use \`/curar\` para remover antes de fazer um novo diagnóstico.`,
                ephemeral: true,
              });
              return;
            }

            // Array de diagnósticos fictícios engraçados (expandido)
            const diagnosticos = [
              {
                nome: "Síndrome do Meme Compulsivo",
                descricao:
                  "Incapacidade de comunicar-se sem usar memes ou referências obscuras da internet.",
                tratamento:
                  "Recomenda-se 30 minutos diários de conversas formais e evitar Twitter e TikTok por um mês.",
                gravidade: "Moderada",
              },
              {
                nome: "Procrastinite Aguda",
                descricao:
                  "Tendência patológica a adiar tarefas importantes para ficar no Discord.",
                tratamento:
                  "Remover todas as notificações do Discord e usar a técnica Pomodoro: 25 minutos de trabalho, 5 de Discord.",
                gravidade: "Severa",
              },
              {
                nome: "Transtorno de Personalidade Gamer",
                descricao:
                  "Pessoas que acreditam que a vida real deveria ter sistema de conquistas e barras de progresso.",
                tratamento:
                  "Terapia de realidade aumentada e abstinência de jogos por 48 horas (se possível).",
                gravidade: "Leve",
              },
              {
                nome: "Delírio de Streamer",
                descricao:
                  "Paciente acredita estar sempre sendo observado e narra suas ações cotidianas.",
                tratamento:
                  "Desativar câmeras do celular e repetir o mantra 'Ninguém está assistindo' ao espelho diariamente.",
                gravidade: "Moderada",
              },
              {
                nome: "Amnésia de Senha",
                descricao:
                  "Incapacidade crônica de lembrar senhas, resultando na criação de variações de 'senha123'.",
                tratamento:
                  "Terapia de gerenciador de senhas e exercícios de memória digital.",
                gravidade: "Crítica",
              },
              {
                nome: "Síndrome do Playlist Infinito",
                descricao:
                  "Condição onde o paciente passa mais tempo procurando o que assistir do que efetivamente assistindo.",
                tratamento:
                  "Limitação a uma plataforma de streaming por vez e técnicas de decisão rápida.",
                gravidade: "Moderada",
              },
              {
                nome: "Crise de Fomo Crônico",
                descricao:
                  "Medo patológico de estar perdendo algo interessante em outro canal do Discord.",
                tratamento:
                  "Reduzir servidores a um número administrável e praticar mindfulness digital.",
                gravidade: "Severa",
              },
              {
                nome: "Transtorno de Déficit de Bateria",
                descricao:
                  "Ansiedade severa quando a bateria de dispositivos cai abaixo de 50%.",
                tratamento:
                  "Exposição gradual a porcentagens menores e carregar o dispositivo apenas quando chegar a 10%.",
                gravidade: "Leve",
              },
              {
                nome: "Capitalismo de Discord",
                descricao:
                  "Obsessão em acumular cargos, emojis e status no servidor como forma de riqueza virtual.",
                tratamento:
                  "Redistribuição voluntária de privilégios e terapia de simplicidade digital.",
                gravidade: "Moderada",
              },
              {
                nome: "Síndrome do Microfone Mudo",
                descricao:
                  "Tendência a falar extensivamente em calls sem perceber que está com o microfone mutado.",
                tratamento:
                  "Configurar alertas visuais de status do microfone e exercícios de percepção de interface.",
                gravidade: "Situacional",
              },
              {
                nome: "Transtorno de Notificação Fantasma",
                descricao:
                  "Paciente sente vibrações e ouve sons de notificações quando não há nenhuma.",
                tratamento:
                  "Período de desintoxicação digital e uso de aplicativo de meditação mindfulness.",
                gravidade: "Leve",
              },
              {
                nome: "Distúrbio de Personalidade Múltipla de Contas",
                descricao:
                  "Incapacidade de escolher qual conta ou perfil usar, criando várias personas online.",
                tratamento:
                  "Terapia de integração digital e limite de uma conta por plataforma.",
                gravidade: "Moderada",
              },
              {
                nome: "Amnésia de Post",
                descricao:
                  "Condição em que a pessoa esquece completamente o que ia escrever enquanto digita.",
                tratamento:
                  "Exercícios de concentração e instalação de extensão de auto-salvamento de rascunhos.",
                gravidade: "Frequente",
              },
              {
                nome: "Síndrome da Wikipedia Infinita",
                descricao:
                  "Compulsão por clicar em links da Wikipedia até se perder completamente do assunto original.",
                tratamento:
                  "Timer rigoroso de 10 minutos por sessão e bloqueio de mais de 3 abas de Wikipedia simultaneamente.",
                gravidade: "Moderada",
              },
              {
                nome: "Delírio de Especialista",
                descricao:
                  "Paciente acredita ser especialista em qualquer assunto após assistir um vídeo de 5 minutos sobre o tema.",
                tratamento:
                  "Curso intensivo de epistemologia e prática de humildade intelectual diária.",
                gravidade: "Severa",
              },
            ];

            // Escolher diagnóstico aleatório
            const diagnosticoRandom =
              diagnosticos[Math.floor(Math.random() * diagnosticos.length)];

            // Duração do diagnóstico: entre 1 e 24 horas (em milissegundos)
            const horasDuracao = Math.floor(Math.random() * 24) + 1;
            const duracaoMs = horasDuracao * 60 * 60 * 1000;
            const currentTime = Date.now();
            const expirationTime = currentTime + duracaoMs;

            // Salvar diagnóstico no banco de dados
            db.run(
              "INSERT INTO active_diagnoses (user_id, diagnosis_name, diagnosis_description, treatment, severity, diagnosed_by, diagnosed_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              [
                paciente.id,
                diagnosticoRandom.nome,
                diagnosticoRandom.descricao,
                diagnosticoRandom.tratamento,
                diagnosticoRandom.gravidade,
                interaction.user.id,
                currentTime,
                expirationTime,
              ],
            );

            // Atualizar estatísticas
            updateScienceStats(paciente.id, "diagnosed");
            updateScienceStats(interaction.user.id, "diagnosis_given");

            // Criar embed para o diagnóstico - MODIFICADO para usar username ao invés de toString()
            const diagnosticoEmbed = new EmbedBuilder()
              .setTitle(`🧠 Diagnóstico: ${diagnosticoRandom.nome}`)
              .setColor(0xffa500)
              .setDescription(`Paciente: ${paciente.username}`)
              .addFields(
                {
                  name: "📋 Descrição Clínica",
                  value: diagnosticoRandom.descricao,
                  inline: false,
                },
                {
                  name: "⚕️ Tratamento Recomendado",
                  value: diagnosticoRandom.tratamento,
                  inline: false,
                },
                {
                  name: "⚠️ Nível de Gravidade",
                  value: diagnosticoRandom.gravidade,
                  inline: true,
                },
                {
                  name: "🔍 Diagnóstico por",
                  value: interaction.user.username,
                  inline: true,
                },
                {
                  name: "⏱️ Duração",
                  value: `${horasDuracao} hora(s)`,
                  inline: true,
                },
              )
              .setFooter({
                text: "Diagnóstico realizado pelo Instituto de Neurociência Aleatória",
              })
              .setTimestamp();

            const message = await interaction.reply({
              embeds: [diagnosticoEmbed],
              fetchReply: true,
            });

            // Adicionar reações automáticas
            try {
              await message.react("🧠");
              await message.react("🩺");
            } catch (error) {
              logSystem("ERROR", "Erro ao adicionar reações:", error);
            }
          },
        );
        break;

      case "experimento":
        const cobaia = interaction.options.getUser("cobaia");
        if (!cobaia) {
          await interaction.reply({
            content: "Você precisa escolher uma cobaia para o experimento!",
            ephemeral: true,
          });
          return;
        }

        // Verificar se a cobaia já tem um experimento ativo
        db.get(
          "SELECT * FROM active_experiments WHERE user_id = ?",
          [cobaia.id],
          async (err, existingExperiment) => {
            if (err) {
              logSystem(
                "ERROR",
                "Erro ao verificar experimento existente:",
                err,
              );
              return;
            }

            if (existingExperiment) {
              await interaction.reply({
                content: `${cobaia.username} já está sob efeito do experimento: **${existingExperiment.experiment_type}**. Use \`/curar\` para remover antes de fazer um novo experimento.`,
                ephemeral: true,
              });
              return;
            }

            // Array de tipos de experimentos (expandido)
            const tiposExperimentos = [
              "Soro da Verdade",
              "Radiação Gamer",
              "Implante Neural",
              "Alteração Genética",
              "Fusão Mental",
              "Terapia de Choque Memeático",
              "Manipulação Temporal",
              "Aumento de QI",
              "Redução de QI",
              "Transferência de Personalidade",
              "Estímulo Emocional Automatizado",
              "Recalibração Neurológica",
              "Indução de Memórias Artificiais",
              "Restauração Cognitiva Avançada",
              "Inversão de Polaridade Cerebral",
              "Teletransporte Psíquico",
              "Modulação de Realidade Percebida",
              "Sincronização Multidimensional",
              "Amplificação Sensorial",
              "Reprogramação Subconsciente",
            ];

            // Array de resultados de experimentos (expandido) - MODIFICADO para usar username ao invés de toString()
            const resultadosExperimentos = [
              `${cobaia.username} agora só consegue falar na ordem inversa das palavras. Sentido muito faz não isso.`,
              `${cobaia.username} desenvolveu uma obsessão inexplicável por abacaxis e os menciona em todas as frases.`,
              `${cobaia.username} agora tem memórias falsas de ter sido um grande pirata nos mares do Caribe.`,
              `${cobaia.username} ganhou a habilidade de ouvir os pensamentos dos emoji, e afirma que eles são extremamente dramáticos.`,
              `${cobaia.username} agora acredita ser um NPC em um jogo e espera pacientemente que alguém inicie uma missão.`,
              `${cobaia.username} desenvolveu uma conexão telepática com as impressoras, e diz que elas são muito pessimistas.`,
              `${cobaia.username} agora fala em código morse quando está nervoso. .. -. - . .-. . ... ... .- -. - . !`,
              `${cobaia.username} passou a enxergar tudo em terceira pessoa, como um jogo, e narra suas próprias ações.`,
              `${cobaia.username} agora tem uma probabilidade de 50% de responder a qualquer pergunta com "Depende... você já tentou desligar e ligar de novo?"`,
              `${cobaia.username} acredita firmemente que é um gato espiritual preso em um corpo humano e ocasionalmente lambe as mãos.`,
              `${cobaia.username} agora tem um delay de 5 segundos entre pensar e falar, causando conversas muito estranhas.`,
              `${cobaia.username} só consegue se comunicar usando referências de filmes dos anos 80.`,
              `${cobaia.username} desenvolveu um sotaque aleatório que muda a cada 10 minutos sem perceber.`,
              `${cobaia.username} agora tem medo irracional de emojis sorridentes, alegando que eles "estão tramando alguma coisa".`,
              `${cobaia.username} passou a acreditar que é um espião em uma missão secreta, e trata atividades cotidianas como operações de alto risco.`,
              `${cobaia.username} passou a enxergar todos os objetos dois centímetros à esquerda de onde realmente estão.`,
              `${cobaia.username} agora escuta uma trilha sonora imaginária que acompanha sua vida e frequentemente comenta sobre ela.`,
              `${cobaia.username} passou a se referir a si mesmo na terceira pessoa e adiciona "O Magnífico" ao fim de seu nome.`,
              `${cobaia.username} agora percebe o tempo 1.5x mais rápido que os demais e se frustra com a "lentidão" de todos.`,
              `${cobaia.username} desenvolveu a capacidade de identificar o sabor de alimentos apenas olhando para eles, mas está sempre errado.`,
              `${cobaia.username} agora acredita que consegue falar com eletrônicos e tenta negociar com eles quando não funcionam.`,
              `${cobaia.username} temporariamente se esquece do conceito de portas e tenta atravessar paredes quando quer mudar de cômodo.`,
              `${cobaia.username} agora precisa fazer uma dança ritual elaborada antes de usar qualquer tecnologia.`,
              `${cobaia.username} passou a acreditar que existe uma pequena civilização vivendo em seu cabelo e toma decisões baseado nos "conselhos" deles.`,
              `${cobaia.username} agora consegue "ver" o Wi-Fi e frequentemente desvia de áreas com sinal fraco durante conversas.`,
            ];

            // Efeitos colaterais (expandido)
            const efeitosColaterais = [
              "Nenhum efeito colateral detectado... por enquanto.",
              "Leve tendência a falar com objetos inanimados.",
              "Possível desenvolvimento de um polegar extra nos próximos dias.",
              "Pode experimentar sonhos vívidos onde é uma torradeira.",
              "Alergia temporária a palavras com a letra 'E'.",
              "Desejo inexplicável de colecionar colheres.",
              "Súbito conhecimento de fatos históricos... mas todos errados.",
              "Aversão a tecnologia fabricada após 1987.",
              "Capacidade de prever o futuro, mas apenas sobre assuntos irrelevantes.",
              "Desenvolvimento de amizade imaginária com um flamingo chamado Geraldo.",
              "Espontaneamente começa a dançar quando ouve a palavra 'protocolo'.",
              "Ocasional visão em preto e branco durante as terças-feiras.",
              "Súbito vocabulário expandido, mas apenas para descrever tipos de queijo.",
              "Temporariamente se esquece como funcionam escadas e tenta subir de formas criativas.",
              "Percepção alterada que faz todos os alimentos terem gosto de marshmallow.",
              "Capacidade de sentir quando alguém está pensando em patos.",
              "Periodicamente ouve a música tema de programas de culinária.",
              "Risos incontroláveis ao ver objetos quadrados.",
              "Desejo de reorganizar móveis por ordem alfabética.",
              "Tendência a falar como se estivesse em uma entrevista coletiva.",
            ];

            // Escolher tipo e resultado aleatórios
            const tipoRandom =
              tiposExperimentos[
                Math.floor(Math.random() * tiposExperimentos.length)
              ];
            const resultadoRandom =
              resultadosExperimentos[
                Math.floor(Math.random() * resultadosExperimentos.length)
              ];
            const efeitoColateralRandom =
              efeitosColaterais[
                Math.floor(Math.random() * efeitosColaterais.length)
              ];

            // Níveis de sucesso do experimento
            const niveisSuccesso = [
              "Falha Crítica",
              "Sucesso Parcial",
              "Sucesso Moderado",
              "Grande Sucesso",
              "Resultado Inesperado",
            ];
            const nivelSucesso =
              niveisSuccesso[Math.floor(Math.random() * niveisSuccesso.length)];

            // Duração do experimento: entre 1 e 24 horas (em milissegundos)
            const horasDuracao = Math.floor(Math.random() * 24) + 1;
            const duracaoMs = horasDuracao * 60 * 60 * 1000;
            const currentTime = Date.now();
            const expirationTime = currentTime + duracaoMs;

            // Salvar experimento no banco de dados
            db.run(
              "INSERT INTO active_experiments (user_id, experiment_type, result, side_effect, success_level, experimenter_id, experiment_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              [
                cobaia.id,
                tipoRandom,
                resultadoRandom,
                efeitoColateralRandom,
                nivelSucesso,
                interaction.user.id,
                currentTime,
                expirationTime,
              ],
            );

            // Atualizar estatísticas
            updateScienceStats(cobaia.id, "experimented");
            updateScienceStats(interaction.user.id, "experiment_conducted");

            // Criar embed para o experimento - MODIFICADO para usar username ao invés de toString()
            const experimentoEmbed = new EmbedBuilder()
              .setTitle(`🧪 Experimento: ${tipoRandom}`)
              .setColor(0x9400d3)
              .setDescription(
                `O cientista ${interaction.user.username} realizou um experimento em ${cobaia.username}!`,
              )
              .addFields(
                { name: "📊 Resultado", value: resultadoRandom, inline: false },
                {
                  name: "📈 Nível de Sucesso",
                  value: nivelSucesso,
                  inline: true,
                },
                {
                  name: "⚠️ Efeitos Colaterais",
                  value: efeitoColateralRandom,
                  inline: true,
                },
                {
                  name: "⏱️ Duração",
                  value: `${horasDuracao} hora(s)`,
                  inline: true,
                },
                {
                  name: "🔬 Notas de Laboratório",
                  value: `Experimento #${Math.floor(Math.random() * 1000) + 1} - CONFIDENCIAL`,
                },
              )
              .setFooter({ text: "Laboratório de Ciência Questionável" })
              .setTimestamp();

            const message = await interaction.reply({
              embeds: [experimentoEmbed],
              fetchReply: true,
            });

            // Adicionar reações automáticas
            try {
              await message.react("🧪");
              await message.react("🔬");
            } catch (error) {
              logSystem("ERROR", "Erro ao adicionar reações:", error);
            }
          },
        );
        break;

      case "ciencia-stats":
        const userForStats = interaction.options.getUser("usuario");
        if (userForStats) {
          // Estatísticas de ciência para um usuário específico
          db.get(
            "SELECT * FROM science_stats WHERE user_id = ?",
            [userForStats.id],
            async (err, stats) => {
              if (err) {
                logSystem(
                  "ERROR",
                  "Erro ao buscar estatísticas de ciência:",
                  err,
                );
                await interaction.reply("Erro ao buscar estatísticas!");
                return;
              }

              const statsEmbed = new EmbedBuilder()
                .setTitle(
                  `🔬 Estatísticas Científicas - ${userForStats.username}`,
                )
                .setColor(0xaa00ff)
                .setThumbnail(userForStats.displayAvatarURL())
                .addFields(
                  {
                    name: "Diagnósticos Recebidos",
                    value: `${stats ? stats.diagnosed_count : 0}`,
                    inline: true,
                  },
                  {
                    name: "Experimentos Sofridos",
                    value: `${stats ? stats.experimented_count : 0}`,
                    inline: true,
                  },
                  {
                    name: "Diagnósticos Realizados",
                    value: `${stats ? stats.diagnosis_given_count : 0}`,
                    inline: true,
                  },
                  {
                    name: "Experimentos Conduzidos",
                    value: `${stats ? stats.experiments_conducted_count : 0}`,
                    inline: true,
                  },
                );

              await interaction.reply({ embeds: [statsEmbed] });
            },
          );
        } else {
          // Ranking geral de ciência
          db.all(
            "SELECT user_id, diagnosed_count + experimented_count as total_science_victim FROM science_stats ORDER BY total_science_victim DESC LIMIT 5",
            [],
            async (err, topVictims) => {
              if (err) {
                logSystem("ERROR", "Erro ao buscar vítimas da ciência:", err);
                await interaction.reply("Erro ao buscar estatísticas!");
                return;
              }

              // Top cientistas (diagnósticos + experimentos)
              db.all(
                "SELECT user_id, diagnosis_given_count + experiments_conducted_count as total_science_given FROM science_stats ORDER BY total_science_given DESC LIMIT 5",
                [],
                async (err, topScientists) => {
                  if (err) {
                    logSystem("ERROR", "Erro ao buscar top cientistas:", err);
                    return;
                  }

                  // Formatar listas de ranking
                  const victimRanking = await Promise.all(
                    topVictims.map(async (row, index) => {
                      const member = await interaction.guild.members
                        .fetch(row.user_id)
                        .catch(() => null);
                      const name = member
                        ? member.nickname || member.user.username
                        : "Usuário Desconhecido";
                      return `${index + 1}. ${name}: ${row.total_science_victim} procedimentos sofridos`;
                    }),
                  );

                  const scientistRanking = await Promise.all(
                    topScientists.map(async (row, index) => {
                      const member = await interaction.guild.members
                        .fetch(row.user_id)
                        .catch(() => null);
                      const name = member
                        ? member.nickname || member.user.username
                        : "Usuário Desconhecido";
                      return `${index + 1}. ${name}: ${row.total_science_given} procedimentos realizados`;
                    }),
                  );
                  const rankingEmbed = new EmbedBuilder()
                    .setTitle("🔬 Ranking Científico do Servidor")
                    .setColor(0xaa00ff)
                    .addFields(
                      {
                        name: "🧠 Top Cobaias da Ciência",
                        value:
                          victimRanking.length > 0
                            ? victimRanking.join("\n")
                            : "Nenhum registro ainda!",
                        inline: false,
                      },
                      {
                        name: "🧪 Top Cientistas",
                        value:
                          scientistRanking.length > 0
                            ? scientistRanking.join("\n")
                            : "Nenhum registro ainda!",
                        inline: false,
                      },
                    );

                  await interaction.reply({ embeds: [rankingEmbed] });
                },
              );
            },
          );
        }
        break;

      case "status-mental":
        const userToCheck =
          interaction.options.getUser("usuario") || interaction.user;

        // Buscar diagnóstico ativo
        db.get(
          "SELECT * FROM active_diagnoses WHERE user_id = ?",
          [userToCheck.id],
          async (err, diagnosis) => {
            if (err) {
              logSystem("ERROR", "Erro ao buscar diagnóstico ativo:", err);
              await interaction.reply("Erro ao buscar status mental!");
              return;
            }

            // Buscar experimento ativo
            db.get(
              "SELECT * FROM active_experiments WHERE user_id = ?",
              [userToCheck.id],
              async (err, experiment) => {
                if (err) {
                  logSystem("ERROR", "Erro ao buscar experimento ativo:", err);
                  return;
                }

                if (!diagnosis && !experiment) {
                  // MODIFICADO para usar username ao invés de toString()
                  await interaction.reply(
                    `${userToCheck.username} não possui nenhum diagnóstico ou efeito de experimento ativo no momento.`,
                  );
                  return;
                }

                const statusEmbed = new EmbedBuilder()
                  .setTitle(`🧠 Status Mental de ${userToCheck.username}`)
                  .setColor(0x00ff00)
                  .setThumbnail(userToCheck.displayAvatarURL());

                if (diagnosis) {
                  const diagnosedBy = await interaction.client.users
                    .fetch(diagnosis.diagnosed_by)
                    .catch(() => ({ username: "Cientista Desconhecido" }));
                  const timeRemaining = diagnosis.expires_at - Date.now();
                  const hoursRemaining = Math.ceil(
                    timeRemaining / (1000 * 60 * 60),
                  );

                  statusEmbed.addFields(
                    {
                      name: "🩺 Diagnóstico Atual",
                      value: diagnosis.diagnosis_name,
                      inline: false,
                    },
                    {
                      name: "📋 Descrição",
                      value: diagnosis.diagnosis_description,
                      inline: false,
                    },
                    {
                      name: "⚕️ Tratamento",
                      value: diagnosis.treatment,
                      inline: false,
                    },
                    {
                      name: "⚠️ Gravidade",
                      value: diagnosis.severity,
                      inline: true,
                    },
                    {
                      name: "👨‍⚕️ Diagnosticado por",
                      value: diagnosedBy.username,
                      inline: true,
                    },
                    {
                      name: "⏱️ Expira em",
                      value: `${hoursRemaining} hora(s)`,
                      inline: true,
                    },
                  );
                }

                if (experiment) {
                  const conductedBy = await interaction.client.users
                    .fetch(experiment.experimenter_id)
                    .catch(() => ({ username: "Cientista Desconhecido" }));
                  const timeRemaining = experiment.expires_at - Date.now();
                  const hoursRemaining = Math.ceil(
                    timeRemaining / (1000 * 60 * 60),
                  );

                  statusEmbed.addFields(
                    {
                      name: "🧪 Experimento Ativo",
                      value: experiment.experiment_type,
                      inline: false,
                    },
                    {
                      name: "📊 Resultado",
                      value: experiment.result,
                      inline: false,
                    },
                    {
                      name: "⚠️ Efeito Colateral",
                      value: experiment.side_effect,
                      inline: false,
                    },
                    {
                      name: "📈 Nível de Sucesso",
                      value: experiment.success_level,
                      inline: true,
                    },
                    {
                      name: "👨‍🔬 Conduzido por",
                      value: conductedBy.username,
                      inline: true,
                    },
                    {
                      name: "⏱️ Expira em",
                      value: `${hoursRemaining} hora(s)`,
                      inline: true,
                    },
                  );
                }

                await interaction.reply({ embeds: [statusEmbed] });
              },
            );
          },
        );
        break;

      case "curar":
        const pacienteCura = interaction.options.getUser("paciente");
        if (!pacienteCura) {
          await interaction.reply({
            content: "Você precisa escolher um paciente para curar!",
            ephemeral: true,
          });
          return;
        }
      case "contagem-alvim":
        // Buscar o status atual de relacionamento do Alvim
        db.get(
          "SELECT * FROM alvim_relationship WHERE id = 1",
          async (err, row) => {
            if (err) {
              logSystem(
                "ERROR",
                "Erro ao buscar status de relacionamento do Alvim:",
                err,
              );
              await interaction.reply(
                "Erro ao buscar informações sobre o Alvim!",
              );
              return;
            }

            if (!row) {
              await interaction.reply(
                "Informações do Alvim não encontradas no banco de dados!",
              );
              return;
            }

            const currentTime = Date.now();
            const startTime = row.start_time;
            const timeDiff = currentTime - startTime;

            // Calcular tempo
            const seconds = Math.floor(timeDiff / 1000) % 60;
            const minutes = Math.floor(timeDiff / (1000 * 60)) % 60;
            const hours = Math.floor(timeDiff / (1000 * 60 * 60)) % 24;
            const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24)) % 365.25;
            const years = Math.floor(timeDiff / (1000 * 60 * 60 * 24 * 365.25));

            // Criar embed com a contagem
            const relationshipEmbed = new EmbedBuilder()
              .setTitle(`💘 Status de Relacionamento do Alvim`)
              .setColor(row.status === "solteiro" ? 0x00ff00 : 0xff0099)
              .setDescription(
                `O Alvim está **${row.status}** ${row.parceiro ? `com **${row.parceiro}** ` : ""}há:`,
              )
              .addFields(
                {
                  name: "⏱️ Tempo Total",
                  value: `${years} anos, ${days} dias, ${hours} horas, ${minutes} minutos e ${seconds} segundos`,
                  inline: false,
                },
                {
                  name: "📆 Desde",
                  value: `<t:${Math.floor(startTime / 1000)}:F> (${new Date(startTime).toLocaleDateString("pt-BR")})`,
                  inline: true,
                },
              )
              .setFooter({
                text:
                  row.status === "solteiro"
                    ? "Força Alvim, um dia você consegue! 💪"
                    : "Finalmente, Alvim! 🎉",
              })
              .setTimestamp();

            if (row.status === "solteiro") {
              // Usar um emoji SVG estável da Twemoji (Twitter Emoji) ou outro CDN confiável
              relationshipEmbed.setThumbnail(
                "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f614.png",
              ); // Emoji pensativo
            } else {
              relationshipEmbed.setThumbnail(
                "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f970.png",
              ); // Emoji apaixonado
            }
            await interaction.reply({ embeds: [relationshipEmbed] });
          },
        );
        break;

      case "alvim-namorando":
        // Verificar permissões (opcional, você pode restringir este comando apenas para admins)
        if (!interaction.member.permissions.has("ADMINISTRATOR")) {
          await interaction.reply({
            content:
              "Você não tem permissão para definir o status de relacionamento do Alvim!",
            ephemeral: true,
          });
          return;
        }

        const parceiro = interaction.options.getString("parceiro");
        const startTime = Date.now();

        // Atualizar status no banco de dados
        db.run(
          "UPDATE alvim_relationship SET status = 'namorando', start_time = ?, parceiro = ? WHERE id = 1",
          [startTime, parceiro],
          async (err) => {
            if (err) {
              logSystem("ERROR", "Erro ao atualizar status do Alvim:", err);
              await interaction.reply(
                "Erro ao atualizar status de relacionamento do Alvim!",
              );
              return;
            }

            const embed = new EmbedBuilder()
              .setTitle("💖 Alvim está namorando!")
              .setColor(0xff0099)
              .setDescription(
                `O Alvim começou a namorar com **${parceiro}**!\nA contagem de solteirice foi reiniciada e agora estamos contando o tempo de relacionamento.`,
              )
              .setFooter({ text: "Parabéns Alvim! 🎉" })
              .setTimestamp();

            await interaction.reply({ embeds: [embed] });
          },
        );
        break;

      case "alvim-terminou":
        // Verificar permissões (opcional)
        if (!interaction.member.permissions.has("ADMINISTRATOR")) {
          await interaction.reply({
            content:
              "Você não tem permissão para definir o status de relacionamento do Alvim!",
            ephemeral: true,
          });
          return;
        }

      case "alvim-corrigir-data":
        // Verificar permissões
        if (!interaction.member.permissions.has("ADMINISTRATOR")) {
          await interaction.reply({
            content: "Você não tem permissão para corrigir a data do Alvim!",
            ephemeral: true,
          });
          return;
        }

        // Data de nascimento do Alvim (20 de junho de 2002 ao meio-dia)
        const correctBirthDate = new Date(2002, 5, 20, 12, 0, 0, 0).getTime();

        // Atualizar a data no banco de dados
        db.run(
          "UPDATE alvim_relationship SET start_time = ? WHERE id = 1 AND status = 'solteiro'",
          [correctBirthDate],
          async (err) => {
            if (err) {
              logSystem(
                "ERROR",
                "Erro ao corrigir data de nascimento do Alvim:",
                err,
              );
              await interaction.reply("Erro ao corrigir a data!");
              return;
            }

            await interaction.reply({
              content:
                "✅ Data de nascimento do Alvim corrigida para 20 de junho de 2002!",
              ephemeral: true,
            });
          },
        );
        break;

        // Buscar informações atuais para o histórico
        db.get(
          "SELECT * FROM alvim_relationship WHERE id = 1",
          async (err, row) => {
            if (err || !row) {
              logSystem("ERROR", "Erro ao buscar status atual do Alvim:", err);
              await interaction.reply(
                "Erro ao atualizar status de relacionamento do Alvim!",
              );
              return;
            }

            // Se estava namorando, salvamos no histórico primeiro
            if (row.status === "namorando") {
              const endTime = Date.now();
              const relationshipDuration = endTime - row.start_time;

              // Podemos criar uma tabela de histórico se quiser manter um registro
              // (código para isso seria adicionado aqui)

              // Atualizar para solteiro novamente
              db.run(
                "UPDATE alvim_relationship SET status = 'solteiro', start_time = ?, parceiro = NULL WHERE id = 1",
                [endTime],
                async (err) => {
                  if (err) {
                    logSystem(
                      "ERROR",
                      "Erro ao atualizar status do Alvim:",
                      err,
                    );
                    await interaction.reply(
                      "Erro ao atualizar status de relacionamento do Alvim!",
                    );
                    return;
                  }

                  // Calcular tempo que durou o relacionamento
                  const seconds = Math.floor(relationshipDuration / 1000) % 60;
                  const minutes =
                    Math.floor(relationshipDuration / (1000 * 60)) % 60;
                  const hours =
                    Math.floor(relationshipDuration / (1000 * 60 * 60)) % 24;
                  const days = Math.floor(
                    relationshipDuration / (1000 * 60 * 60 * 24),
                  );

                  const embed = new EmbedBuilder()
                    .setTitle("💔 Alvim terminou o relacionamento")
                    .setColor(0xff0000)
                    .setDescription(
                      `O relacionamento com **${row.parceiro}** chegou ao fim.`,
                    )
                    .addFields(
                      {
                        name: "⏱️ Duração do Relacionamento",
                        value: `${days} dias, ${hours} horas, ${minutes} minutos e ${seconds} segundos`,
                        inline: false,
                      },
                      {
                        name: "🔄 Contagem de Solteirice",
                        value:
                          "A contagem de tempo de solteiro foi reiniciada a partir de agora.",
                        inline: false,
                      },
                    )
                    .setFooter({ text: "Força, Alvim! Bola pra frente! 🎮" })
                    .setTimestamp();

                  await interaction.reply({ embeds: [embed] });
                },
              );
            } else {
              await interaction.reply(
                "O Alvim já está solteiro! Não é possível terminar um relacionamento inexistente.",
              );
            }
          },
        );
        break;

        // Adicionar a coluna "parceiro" à tabela se ainda não existir
        db.exec("PRAGMA table_info(alvim_relationship)", (err, rows) => {
          if (err) {
            logSystem(
              "ERROR",
              "Erro ao verificar colunas da tabela alvim_relationship:",
              err,
            );
            return;
          }

          // Verificar se a coluna "parceiro" já existe
          const hasParceiro =
            rows && rows.some((row) => row.name === "parceiro");

          if (!hasParceiro) {
            db.run(
              "ALTER TABLE alvim_relationship ADD COLUMN parceiro TEXT",
              (err) => {
                if (err) {
                  logSystem("ERROR", "Erro ao adicionar coluna parceiro:", err);
                } else {
                  logSystem(
                    "SUCCESS",
                    "Coluna parceiro adicionada com sucesso à tabela alvim_relationship",
                  );
                }
              },
            );
          }
        });

        const tipoCura = interaction.options.getString("tipo");

        // Verificar se o paciente tem algo para curar
        db.get(
          "SELECT * FROM active_diagnoses WHERE user_id = ?",
          [pacienteCura.id],
          async (err, diagnosis) => {
            if (err) {
              logSystem("ERROR", "Erro ao verificar diagnóstico ativo:", err);
              await interaction.reply("Erro ao curar paciente!");
              return;
            }

            db.get(
              "SELECT * FROM active_experiments WHERE user_id = ?",
              [pacienteCura.id],
              async (err, experiment) => {
                if (err) {
                  logSystem(
                    "ERROR",
                    "Erro ao verificar experimento ativo:",
                    err,
                  );
                  return;
                }

                if (!diagnosis && !experiment) {
                  // MODIFICADO para usar username ao invés de toString()
                  await interaction.reply(
                    `${pacienteCura.username} não possui nenhum diagnóstico ou efeito de experimento ativo para curar.`,
                  );
                  return;
                }

                let mensagemCura = "";

                // Curar diagnóstico se solicitado
                if (
                  (tipoCura === "diagnosis" || tipoCura === "both") &&
                  diagnosis
                ) {
                  db.run("DELETE FROM active_diagnoses WHERE user_id = ?", [
                    pacienteCura.id,
                  ]);
                  mensagemCura += `✅ O diagnóstico **${diagnosis.diagnosis_name}** foi curado com sucesso!\n`;
                }

                // Curar experimento se solicitado
                if (
                  (tipoCura === "experiment" || tipoCura === "both") &&
                  experiment
                ) {
                  db.run("DELETE FROM active_experiments WHERE user_id = ?", [
                    pacienteCura.id,
                  ]);
                  mensagemCura += `✅ Os efeitos do experimento **${experiment.experiment_type}** foram removidos com sucesso!\n`;
                }

                if (mensagemCura === "") {
                  mensagemCura = `Não foi encontrado nenhum ${tipoCura === "diagnosis" ? "diagnóstico" : "experimento"} ativo para curar.`;
                }

                // MODIFICADO para usar username ao invés de toString()
                const message = await interaction.reply({
                  content: `**Tratamento realizado em ${pacienteCura.username}**\n\n${mensagemCura}`,
                  fetchReply: true,
                });

                // Adicionar reações automáticas
                try {
                  await message.react("💊");
                  await message.react("🩺");
                } catch (error) {
                  logSystem("ERROR", "Erro ao adicionar reações:", error);
                }
              },
            );
          },
        );
        break;
    }
  } catch (error) {
    logSystem(
      "ERROR",
      `Erro ao executar comando /${interaction.commandName}:`,
      error,
    );
    await interaction.reply({
      content: "Houve um erro ao executar este comando!",
      ephemeral: true,
    });
  }
});

// Modificar o código para registrar comandos em um servidor específico (mais rápido)
(async function () {
  try {
    logSystem("INFO", "Iniciando registro dos comandos slash...");

    // ID do servidor onde você quer que os comandos sejam registrados
    const GUILD_ID = "1285627861016772608";

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, GUILD_ID),
      { body: commands },
    );

    logSystem(
      "SUCCESS",
      `Comandos slash registrados com sucesso para o servidor ${GUILD_ID}!`,
    );
  } catch (error) {
    logSystem("ERROR", "Erro ao registrar comandos slash:", error);
  }
})();

// Verifica se o token está configurado
if (!TOKEN) {
  logSystem(
    "ERROR",
    "TOKEN não configurado! Configure a variável de ambiente TOKEN",
  );
  process.exit(1);
}

// Conecta o bot ao Discord usando o token
client
  .login(TOKEN)
  .then(() => logSystem("SUCCESS", "Login no Discord realizado com sucesso!"))
  .catch((err) => logSystem("ERROR", "Falha ao fazer login no Discord:", err));
