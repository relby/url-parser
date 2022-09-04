FROM node:18
WORKDIR /usr/share/app/
COPY ./ ./
RUN npm ci
EXPOSE 3000
ENV PORT=3000
ENV HOST=0.0.0.0
CMD ["npm", "start"]
