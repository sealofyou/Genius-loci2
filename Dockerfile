FROM modelscope-registry.cn-beijing.cr.aliyuncs.com/modelscope-repo/python:3.10

WORKDIR /home/user/app

# 安装 Node.js 20.x
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# 复制前端项目文件
COPY ./front /home/user/app/front

# 设置工作目录
WORKDIR /home/user/app/front

# 安装依赖
RUN npm install

# 构建项目（重要！）
RUN npm run build

# 安装http-server
RUN npm install http-server --save-dev

# 暴露端口
EXPOSE 7860

# 启动命令（不是构建时运行）
CMD ["npx", "http-server", "dist", "-p", "7860", "--host", "0.0.0.0"]