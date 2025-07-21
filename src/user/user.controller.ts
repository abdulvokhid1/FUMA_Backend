import { Body, Controller, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { LoginDto, RegisterDto } from './dto/user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.userService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.userService.login(dto);
  }
}
