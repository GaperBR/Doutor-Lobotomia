// Importando as dependências necessárias
const { Client, GatewayIntentBits, Events, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require("discord.js");
const sqlite3 = require('sqlite3').verbose();

// Configurar banco de dados
const db = new sqlite3.Database('voicetime.db');

// Criar tabela se não existir
db.run(`
  CREATE TABLE IF NOT EXISTS voice_time (
    user_id TEXT PRIMARY KEY,
    total_time INTEGER DEFAULT 0,
    start_time INTEGER DEFAULT 0
  )
`, (err) => {
  if (err) {
    logSystem('ERROR', 'Erro ao criar tabela:', err);
  } else {
    logSystem('SUCCESS', 'Banco de dados inicializado com sucesso');
  }
});

// Verificar conexão com o banco de dados
db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='voice_time'", (err, row) => {
  if (err) {
    logSystem('ERROR', 'Erro ao verificar tabelas:', err);
  } else if (!row) {
    logSystem('WARNING', 'Tabela voice_time não encontrada');
  } else {
    logSystem('SUCCESS', 'Conexão com o banco de dados estabelecida');
  }
});

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


const fs = require('fs');

// Função para logs
function logSystem(type, message, error = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${type}] ${message}`;
  const logFile = 'bot.log';

  // Log no console
  switch(type) {
    case 'ERROR':
      console.error('\x1b[31m%s\x1b[0m', logMessage); // Vermelho
      if (error) {
        console.error('\x1b[31m%s\x1b[0m', 'Detalhes do erro:', error);
      }
      break;
    case 'WARNING':
      console.warn('\x1b[33m%s\x1b[0m', logMessage); // Amarelo
      break;
    case 'SUCCESS':
      console.log('\x1b[32m%s\x1b[0m', logMessage); // Verde
      break;
    default:
      console.log('\x1b[36m%s\x1b[0m', logMessage); // Ciano
  }

  // Salvar em arquivo
  fs.appendFileSync(logFile, logMessage + (error ? '\nError details: ' + error : '') + '\n');
}

// Criando uma nova instância do cliente
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ],
});

// Tratamento de erros global
process.on('unhandledRejection', (error) => {
  logSystem('ERROR', 'Erro não tratado:', error);
});

client.on('error', (error) => {
  logSystem('ERROR', 'Erro no cliente Discord:', error);
});

// Token do seu bot como variável de ambiente
const TOKEN = process.env.TOKEN;

// Definir comandos slash
const commands = [
  new SlashCommandBuilder()
    .setName('refresh')
    .setDescription('Atualiza os comandos do bot'),
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Responde com Pong!'),
  new SlashCommandBuilder()
    .setName('ola')
    .setDescription('Receba uma saudação personalizada'),
  new SlashCommandBuilder()
    .setName('ajuda')
    .setDescription('Mostra a lista de comandos disponíveis'),
  new SlashCommandBuilder()
    .setName('ranking')
    .setDescription('Mostra o ranking de tempo em call')
];

// Adicionando o comando "lobotomizar" à lista de comandos
commands.push(
  new SlashCommandBuilder()
    .setName('lobotomizar')
    .setDescription('Realiza uma lobotomia em um nerdola')
    .addUserOption(option =>
      option.setName('alvo')
        .setDescription('Escolha o alvo para lobotomizar')
        .setRequired(true))
);

// Registrar comandos slash
const rest = new REST().setToken(TOKEN);

(async () => {
  try {
    logSystem('INFO', 'Iniciando registro dos comandos slash...');
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands },
    );
    logSystem('SUCCESS', 'Comandos slash registrados com sucesso!');
  } catch (error) {
    logSystem('ERROR', 'Erro ao registrar comandos slash:', error);
  }
})();

// Quando o bot estiver pronto
client.once(Events.ClientReady, (readyClient) => {
  logSystem('SUCCESS', `Bot está online como ${readyClient.user.tag}!`);
  logSystem('INFO', `Conectado em ${client.guilds.cache.size} servidores`);

  // Log das permissões do bot
  client.guilds.cache.forEach(guild => {
    const botMember = guild.members.cache.get(client.user.id);
    logSystem('INFO', `Permissões no servidor ${guild.name}:`, 
      Array.from(botMember.permissions.toArray()));
  });
});

// Função para atualizar tempo em tempo real
function updateVoiceTime() {
  client.guilds.cache.forEach(guild => {
    guild.channels.cache.forEach(channel => {
      if (channel.type === 2) { // 2 é o tipo de canal de voz
        channel.members.forEach(member => {
          const userId = member.user.id;
          db.get('SELECT * FROM voice_time WHERE user_id = ?', [userId], (err, row) => {
            if (row && row.start_time > 0) {
              const currentTime = Date.now();
              const timeToAdd = currentTime - row.start_time;
              const newTotal = (row.total_time || 0) + timeToAdd;

              console.log(`Atualizando tempo para ${member.user.username}: +${Math.floor(timeToAdd/1000)}s`);

              // Atualiza o tempo total e define um novo start_time
              db.run('UPDATE voice_time SET total_time = ?, start_time = ? WHERE user_id = ?', 
                [newTotal, currentTime, userId]);
            }
          });
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
    db.run('INSERT OR IGNORE INTO voice_time (user_id, total_time, start_time) VALUES (?, 0, ?)', [userId, startTime], (err) => {
      if (!err) {
        db.run('UPDATE voice_time SET start_time = ? WHERE user_id = ?', [startTime, userId]);
      }
    });
  }

  // Usuário saiu de uma chamada
  if (oldState.channelId && !newState.channelId) {
    db.get('SELECT * FROM voice_time WHERE user_id = ?', [userId], (err, row) => {
      if (row && row.start_time > 0) {
        const sessionTime = Date.now() - row.start_time;
        const newTotal = row.total_time + sessionTime;
        db.run('UPDATE voice_time SET total_time = ?, start_time = 0 WHERE user_id = ?', [newTotal, userId]);
      }
    });
  }
});

// Evento para lidar com interações de comando
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  logSystem('INFO', `Comando "/${interaction.commandName}" executado por ${interaction.user.username} no canal #${interaction.channel.name}`);

  try {
    switch (interaction.commandName) {
      case 'refresh':
        await interaction.deferReply();
        try {
          await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
          );
          await interaction.editReply('✅ Comandos atualizados com sucesso!');
        } catch (error) {
          logSystem('ERROR', 'Erro ao atualizar comandos:', error);
          await interaction.editReply('❌ Erro ao atualizar comandos!');
        }
        break;
        
      case 'ping':
        await interaction.reply('Pong!');
        break;

      case 'ola':
        await interaction.reply(`Olá, ${interaction.user.username}!`);
        break;

      case 'ajuda':
        await interaction.reply('Comandos disponíveis:\n/ping - Teste de latência\n/ola - Receba uma saudação\n/ajuda - Lista de comandos\n/ranking - Veja o ranking de tempo em call\n/piada - Conta uma piada');
        break;

      case 'ranking':
        db.all('SELECT * FROM voice_time ORDER BY total_time DESC LIMIT 10', [], async (err, rows) => {
      const rankingList = await Promise.all(rows.map(async (row, index) => {
        const member = await interaction.guild.members.fetch(row.user_id).catch(() => null);
        const name = member ? (member.nickname || member.user.username) : 'Usuário Desconhecido';
        const hours = Math.floor(row.total_time / 3600000);
        const minutes = Math.floor((row.total_time % 3600000) / 60000);
        return `${index + 1}. ${name}: ${hours}h ${minutes}m`;
      }));

      const embed = new EmbedBuilder()
        .setTitle("🏆 Ranking de Tempo em Lobotocall")
        .setColor(0x0099FF)
        .setDescription(rankingList.join("\n") || "Nenhum registro ainda!");

      await interaction.reply({ embeds: [embed] });
    });
        break;

      case 'lobotomizar':
        const alvo = interaction.options.getUser('alvo');
        if (!alvo) {
          await interaction.reply({ content: 'Você precisa escolher um alvo para lobotomizar!', ephemeral: true });
          return;
        }

        const mensagem = `@${interaction.user.username} realizou uma lobotomia no nerdola do @${alvo.username}`;
        const imagem = './Lobotomia.png'; // Substitua pelo link da imagem ou caminho local

        await interaction.reply({
          content: mensagem,
          files: [imagem]
        });
        break;
    }
  } catch (error) {
    logSystem('ERROR', `Erro ao executar comando /${interaction.commandName}:`, error);
    await interaction.reply({ content: 'Houve um erro ao executar este comando!', ephemeral: true });
  }
});

// Conecta o bot ao Discord usando o token
client.login(TOKEN).catch(console.error);
