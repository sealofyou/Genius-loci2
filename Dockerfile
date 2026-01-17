FROM modelscope-registry.cn-beijing.cr.aliyuncs.com/modelscope-repo/python:3.10

WORKDIR /home/user/app

# 安装 Node.js 18.x
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# 复制前端项目文件
COPY ./front /home/user/app/front

# 安装前端依赖
WORKDIR /home/user/app/front
RUN npm install

# 构建前端项目
RUN npm run dev

# 暴露端口
EXPOSE 7860
