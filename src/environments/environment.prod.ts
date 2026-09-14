import {SquareEnv} from "../app/shared/square-env.type";

export const environment = {
  production: true,
  PROTOCOL: 'https',
  FE_PATH: 'https://www.telehealthus.com',
  IAMGE_PATH: 'https://api-prod-ec2.impacthealthos.com',
  baseURL: 'api-prod-ec2.impacthealthos.com/api',
  ROOT_URL: 'www.telehealthus.com',
  LOGO: 'https://www.telehealthus.com/assets/img/impact-health-logo-dark.png',
  fullscript: {
    publicKey: 'X4JIEEXSti_X8H5hS0ulTWeQvG0Y8TZwUR6e5UcyNu0',
    env: 'us-snd' as const,
  },
  squareEnv: 'production' as SquareEnv,
  stripePublishableKey: 'pk_live_51QvCeCK52jGqJZbVilYJZT76suvQmqJgDBCFhxdh6bzLgCqZlLu6OmLCQ9z5qWenzrGk0YjMirjjBlhR7nEdQ01p00dzDONcsp',
};
