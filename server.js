// 1. 导入所需模块
const express = require('express');
const fs = require('fs').promises; // 异步文件操作（支持 await）
const path = require('path'); // 处理文件路径，避免跨平台问题

const app = express();
const port = 3000;

// 解析 JSON 请求体
app.use(express.json());

// 2. 定义文件路径（关键：确保路径正确）
// __dirname 是当前文件所在目录，todos.json 是存储数据的文件
const TODO_FILE_PATH = path.resolve(__dirname, 'todos.json');

// 3. 核心辅助函数：文件读写（封装成复用函数）
/**
 * 从 JSON 文件读取 TODO 数据
 * @returns {Array} TODO 数组
 */
async function readTodosFromFile() {
  try {
    // 读取文件内容（utf8 编码）
    const fileContent = await fs.readFile(TODO_FILE_PATH, 'utf8');
    // 解析 JSON 为数组
    return JSON.parse(fileContent);
  } catch (error) {
    // 异常处理：文件不存在/解析失败时，创建文件并返回初始空数组
    if (error.code === 'ENOENT') {
      // 文件不存在，创建文件并写入初始空数组
      await writeTodosToFile([]);
      return [];
    }
    // 其他错误（如 JSON 解析错误），抛出异常让上层处理
    throw new Error(`读取 TODO 文件失败：${error.message}`);
  }
}

/**
 * 将 TODO 数据写入 JSON 文件
 * @param {Array} todos 要写入的 TODO 数组
 */
async function writeTodosToFile(todos) {
  try {
    // 格式化 JSON 写入（2 个空格缩进，方便阅读）
    const jsonContent = JSON.stringify(todos, null, 2);
    await fs.writeFile(TODO_FILE_PATH, jsonContent, 'utf8');
  } catch (error) {
    throw new Error(`写入 TODO 文件失败：${error.message}`);
  }
}

/**
 * 生成唯一 ID（基于文件中的最大 ID 自增）
 */
async function generateUniqueId() {
  const todos = await readTodosFromFile();
  if (todos.length === 0) return 1;
  const maxId = Math.max(...todos.map(todo => todo.id));
  return maxId + 1;
}

// ====================== TODO API 实现（文件持久化版） ======================
// 1. 获取所有 TODO
app.get('/todo', async (req, res) => {
  try {
    const todos = await readTodosFromFile();
    res.status(200).json({
      success: true,
      count: todos.length,
      data: todos
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 2. 获取指定 ID 的 TODO
app.get('/todo/:id', async (req, res) => {
  try {
    const todoId = parseInt(req.params.id);
    const todos = await readTodosFromFile();
    const todo = todos.find(item => item.id === todoId);

    if (!todo) {
      return res.status(404).json({
        success: false,
        message: `未找到 ID 为 ${todoId} 的 TODO`
      });
    }

    res.status(200).json({
      success: true,
      data: todo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 3. 创建新的 TODO
app.post('/todo', async (req, res) => {
  try {
    const { title, completed = false } = req.body;
    // 验证必填字段
    if (!title || typeof title !== 'string') {
      return res.status(400).json({
        success: false,
        message: "创建失败：title 是必填项，且必须是字符串"
      });
    }

    // 读取现有数据 → 创建新 TODO → 写入文件
    const todos = await readTodosFromFile();
    const newTodo = {
      id: await generateUniqueId(),
      title: title.trim(),
      completed: Boolean(completed),
      createTime: new Date().toISOString()
    };
    todos.push(newTodo);
    await writeTodosToFile(todos);

    res.status(201).json({
      success: true,
      message: "TODO 创建成功",
      data: newTodo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 4. 修改指定 ID 的 TODO
app.put('/todo/:id', async (req, res) => {
  try {
    const todoId = parseInt(req.params.id);
    const { title, completed } = req.body;

    const todos = await readTodosFromFile();
    const todoIndex = todos.findIndex(item => item.id === todoId);

    if (todoIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `修改失败：ID 为 ${todoId} 的 TODO 不存在`
      });
    }

    // 更新 TODO 数据
    const updatedTodo = {
      ...todos[todoIndex],
      ...(title && { title: title.trim() }),
      ...(completed !== undefined && { completed: Boolean(completed) })
    };
    todos[todoIndex] = updatedTodo;

    // 写入文件
    await writeTodosToFile(todos);

    res.status(200).json({
      success: true,
      message: "TODO 修改成功",
      data: updatedTodo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 5. 删除指定 ID 的 TODO
app.delete('/todo/:id', async (req, res) => {
  try {
    const todoId = parseInt(req.params.id);
    const todos = await readTodosFromFile();
    const todoIndex = todos.findIndex(item => item.id === todoId);

    if (todoIndex === -1) {
      return res.status(404).json({
        success: false,
        message: `删除失败：ID 为 ${todoId} 的 TODO 不存在`
      });
    }

    // 删除并写入文件
    todos.splice(todoIndex, 1);
    await writeTodosToFile(todos);

    res.status(200).json({
      success: true,
      message: `ID 为 ${todoId} 的 TODO 已删除`,
      data: { id: todoId }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 启动服务器
app.listen(port, async () => {
  // 启动时确保文件存在（初始化）
  await readTodosFromFile();
  console.log(`服务器运行中：http://localhost:${port}`);
  console.log(`TODO 数据文件路径：${TODO_FILE_PATH}`);
});